import os
import io
import uvicorn
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import docx

# Load local .env file if available
env_path = Path(__file__).resolve().parent.parent / '.env'
if env_path.exists():
    for line in env_path.read_text(encoding='utf-8').splitlines():
        if not line or line.strip().startswith('#'):
            continue
        if '=' not in line:
            continue
        key, value = line.split('=', 1)
        os.environ.setdefault(key.strip(), value.strip())

app = FastAPI(title="Mimic AI Backend")

# Setup CORS to allow our frontend to communicate with this backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory storage for the uploaded corpus and persona profile (for demonstration)
# In production, store this in a database or vector store.
app_state = {
    "persona_name": "",
    "persona_profile": "",
    "corpus_text": "",
    "is_trained": False,
    "chat_history": []
}

# --- Pydantic Models ---
class PersonaInitRequest(BaseModel):
    persona_name: str

class ChatRequest(BaseModel):
    message: str
    persona_name: str = "Custom Persona"

# --- Endpoints ---

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    if not file.filename.endswith(('.txt', '.md', '.docx', '.doc')):
        raise HTTPException(status_code=400, detail="Only .txt, .md, and .docx files are supported.")
    
    content = await file.read()
    text = ""
    
    if file.filename.endswith('.docx'):
        try:
            doc = docx.Document(io.BytesIO(content))
            text = "\n".join([paragraph.text for paragraph in doc.paragraphs])
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Failed to read docx file: {str(e)}")
    elif file.filename.endswith('.doc'):
        # Just in case they upload an old .doc, we warn them to save as .docx
        raise HTTPException(status_code=400, detail="Older .doc format is not supported. Please save your file as .docx in Word and upload again.")
    else:
        # For .txt and .md
        try:
            text = content.decode('utf-8')
        except UnicodeDecodeError:
            raise HTTPException(status_code=400, detail="File could not be decoded. Please use UTF-8 text files.")
    
    # Append to our in-memory corpus
    app_state["corpus_text"] += f"\n\n--- Start of Document: {file.filename} ---\n{text}\n--- End of Document ---"
    
    return {"message": "File uploaded and appended to corpus successfully."}


@app.post("/api/init_persona")
async def init_persona(req: PersonaInitRequest):
    persona_name = req.persona_name.strip()
    if not persona_name:
        raise HTTPException(status_code=400, detail="Persona name cannot be empty.")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY environment variable is not set on the server.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')

    prompt = (
        f"你现在是一个知识型 AI，扮演搜索引擎和人设专家。请检索关于“{persona_name}”的背景信息，"
        f"总结出该人物的核心性格特点、经典语录、说话语气结构和常用表达方式。"
        f"请生成一份可用于人物语气模仿的 Persona Profile。"
    )

    try:
        response = model.generate_content([
            {"role": "user", "parts": [prompt]}
        ])
        profile = response.text.strip()

        app_state["persona_name"] = persona_name
        app_state["persona_profile"] = profile
        app_state["corpus_text"] = ""
        app_state["is_trained"] = False
        app_state["chat_history"] = []

        return {"message": "Persona initialized successfully.", "profile": profile}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/train")
async def train_model():
    if not app_state["persona_profile"]:
        raise HTTPException(status_code=400, detail="Please initialize a persona first.")
    if not app_state["corpus_text"]:
        raise HTTPException(status_code=400, detail="No corpus uploaded yet.")

    # This demo does not perform real model training.
    # We simply mark the user-uploaded corpus as fused with the persona profile.
    app_state["is_trained"] = True
    app_state["chat_history"] = []
    return {"message": "Training complete. The bot has fused persona profile with uploaded corpus."}


@app.post("/api/chat")
async def chat_with_bot(req: ChatRequest):
    if not app_state["persona_profile"]:
        raise HTTPException(status_code=400, detail="Bot persona is not initialized yet. Please initialize a persona first.")

    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY environment variable is not set on the server.")

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')

    system_instruction = (
        f"你现在扮演 '{app_state['persona_name']}'. 以下是你自动检索到的人设背景：\n{app_state['persona_profile']}\n\n"
        f"请严格按照上述风格与语气回答用户的问题。"
    )

    if app_state["corpus_text"]:
        system_instruction += (
            "\n\n此外，用户已经上传了以下补充语料，请将其与上述人物人设融合，"
            "并在回答时体现出两者的风格。\n" + app_state["corpus_text"][:50000]
        )

    messages = [{"role": "user", "parts": [system_instruction]}]
    messages.append({"role": "model", "parts": ["Understood. I will follow that tone."]})
    messages.extend(app_state["chat_history"])
    messages.append({"role": "user", "parts": [req.message]})

    try:
        response = model.generate_content(messages)
        reply = response.text

        app_state["chat_history"].append({"role": "user", "parts": [req.message]})
        app_state["chat_history"].append({"role": "model", "parts": [reply]})

        return {"reply": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    print("Starting Mimic AI Backend on http://localhost:8000")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
