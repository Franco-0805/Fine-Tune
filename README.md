**Introduction**:  A lightweight tone-mimicking web app that lets users enter a persona name, auto-fetches that persona’s style and background via Gemini, and then refines the voice with user-uploaded corpus files. The frontend handles persona setup, file upload, and chat UI, while the FastAPI backend stores the generated persona profile and corpus text, then builds prompt-context for Gemini to produce persona-consistent replies.
Project Status

**Current Stage**:
This project is currently in an early prototype stage.It uses a simple prompt-based approach with the Gemini API to generate and simulate custom personas.
The app sends structured prompts to Gemini, stores the generated persona profile in memory, and uses it to drive consistent chatbot responses.
How It Works Today

The user enters a target persona name.
The backend sends a persona-generation prompt to Gemini.
Gemini returns a structured persona profile.
The profile is stored in the application state (in-memory temporary storage).
When users upload corpus files, the system does not perform fine-tuning or model training.
Uploaded text is appended to the chat prompt and used only as contextual reference for bot responses.
Limitations (Not Yet Implemented)

No actual model fine-tuning on user-uploaded corpus.
The bot does not “learn” the corpus via dedicated training.
Uploaded files are not converted to embeddings, vectors, or model weights.
The system relies only on prompt engineering.
Future Roadmap

Add Gemini fine-tuning support to enable real model learning from user corpus.
Implement RAG (Retrieval-Augmented Generation) for intelligent indexing and retrieval of uploaded documents.
Improve persona consistency and long-term memory.
Summary

This is a lightweight prototype demonstrating persona-driven chatbots using Gemini prompt engineering.Future versions will evolve into a full-featured learning system using fine-tuning and RAG for more realistic knowledge retention.
