import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000"
});

// Helper to set token per request
export const authHeader = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`
  }
});

export default api;
