from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, engine
from .routers import auth_routes, policy_summary, fraud_detection, doc_classification

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="Insurance SaaS Backend",
    description="Multi-tenant backend for Policy Summary, Fraud Detection, and Document Classification.",
    version="0.1.0",
)

# CORS (adjust origins later for your frontend)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for dev; change in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_routes.router)
app.include_router(policy_summary.router)
app.include_router(fraud_detection.router)
app.include_router(doc_classification.router)


@app.get("/")
def read_root():
    return {"message": "Insurance SaaS Backend is running."}
