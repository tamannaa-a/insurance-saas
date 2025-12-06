import axios from "axios";

const api = axios.create({
  baseURL: "http://localhost:8000"
});

export const authHeader = (token) => ({
  headers: {
    Authorization: `Bearer ${token}`
  }
});

export default api;
