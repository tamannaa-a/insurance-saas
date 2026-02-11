ClaimAxis is a full-stack AI-driven insurance automation platform built to streamline policy analysis, fraud detection, and document classification for insurance operations. It enables insurers and claims teams to extract insights from unstructured documents and claim narratives using intelligent backend processing and a modern interactive UI.

Features

Policy Summary Assistant – Generates structured summaries from lengthy policy documents, highlighting coverage, limits, and exclusions.

Fraud Detection Engine – Analyzes claim descriptions, assigns risk scores, and provides explainable fraud reasoning.

Document Classification Workbench – Classifies insurance documents (policies, invoices, claim forms) and extracts key fields.

Real-Time Dashboard – Displays live processing metrics and operational insights.

Tech Stack

Built using React + Vite for the frontend, FastAPI (Python) for the backend, SQLAlchemy ORM for database management, JWT authentication for secure access, and REST APIs for communication between frontend and backend.

How It Works

User input (policy text, claim narrative, or document) is sent from the React frontend to FastAPI endpoints. The backend applies NLP and rule-based logic to analyze the content and returns structured insights, which are rendered dynamically in the UI.
