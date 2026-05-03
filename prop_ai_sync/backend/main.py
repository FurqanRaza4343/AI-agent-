import os
import sqlite3
import requests
import json
from datetime import datetime

# Configuration
APP_DIR = "apps/prop_ai/backend"
DATA_DIR = os.path.join(APP_DIR, "data/db")
DB_PATH = os.path.join(DATA_DIR, "app.db")

def _get_db():
    """Open a connection with recommended settings."""
    os.makedirs(DATA_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn

def _init_db():
    """Initialize the database schema and demo data."""
    print("[BACKEND_STEP] Initializing database...")
    conn = _get_db()
    try:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                budget TEXT,
                area TEXT,
                lead_score TEXT,
                visit_scheduled BOOLEAN DEFAULT 0,
                phone TEXT,
                preferred_date TEXT,
                preferred_time TEXT,
                property_interest TEXT,
                timestamp TEXT DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Check if empty and add demo data
        count = conn.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
        if count == 0:
            print("[BACKEND_STEP] Adding demo leads...")
            demo_leads = [
                ("Ahmed Khan", "1.5cr", "DHA", "HOT", 1, "0300-1234567"),
                ("Sara Malik", "80L", "North Nazimabad", "WARM", 0, "0321-7654321"),
                ("Bilal Ahmed", "5cr", "Clifton", "COLD", 0, "0333-1122334")
            ]
            conn.executemany("""
                INSERT INTO leads (name, budget, area, lead_score, visit_scheduled, phone)
                VALUES (?, ?, ?, ?, ?, ?)
            """, demo_leads)
            conn.commit()
    finally:
        conn.close()

def get_leads():
    """Returns all leads from the database."""
    print("[BACKEND_START] get_leads called")
    _init_db()  # Ensure DB is ready
    conn = _get_db()
    try:
        rows = conn.execute("SELECT * FROM leads ORDER BY timestamp DESC").fetchall()
        leads = [dict(r) for r in rows]
        print(f"[BACKEND_SUCCESS] Returning {len(leads)} leads")
        return leads
    except Exception as e:
        print(f"[BACKEND_ERROR] get_leads failed: {str(e)}")
        raise
    finally:
        conn.close()

def add_lead(name, budget, area, lead_score, visit_scheduled=False, phone=None, preferred_date=None, preferred_time=None, property_interest=None):
    """Adds a new lead and returns the record."""
    print(f"[BACKEND_START] add_lead called for {name}")
    _init_db()
    conn = _get_db()
    try:
        cursor = conn.execute("""
            INSERT INTO leads (name, budget, area, lead_score, visit_scheduled, phone, preferred_date, preferred_time, property_interest)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (name, budget, area, lead_score, 1 if visit_scheduled else 0, phone, preferred_date, preferred_time, property_interest))
        conn.commit()
        lead_id = cursor.lastrowid
        row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
        res = dict(row)
        print(f"[BACKEND_SUCCESS] Lead added with ID {lead_id}")
        return res
    except Exception as e:
        print(f"[BACKEND_ERROR] add_lead failed: {str(e)}")
        raise
    finally:
        conn.close()

def chat_with_ai(messages, api_key=None):
    """Sends messages to Groq API using Llama-3.3-70b."""
    print("[BACKEND_START] chat_with_ai called")
    
    # Prioritize provided api_key, then environment variable
    effective_api_key = api_key or os.environ.get("GROQ_API_KEY")
    if not effective_api_key:
        print("[BACKEND_ERROR] Missing Groq API Key")
        raise ValueError("Groq API Key is required. Please provide it in the arguments or set GROQ_API_KEY environment variable.")

    system_prompt = (
        "You are 'Prop-AI', a specialized real estate assistant for Karachi, Pakistan. "
        "Your goal is to help users find properties in Karachi (DHA, Clifton, North Nazimabad, Gulshan, etc.), "
        "manage their leads, and schedule visits. Be professional, helpful, and knowledgeable about Karachi's "
        "real estate market trends, prices, and locations."
    )
    
    # Construct payload with system prompt
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [{"role": "system", "content": system_prompt}] + messages,
        "temperature": 0.7,
        "max_tokens": 1024
    }
    
    headers = {
        "Authorization": f"Bearer {effective_api_key}",
        "Content-Type": "application/json"
    }
    
    try:
        print("[BACKEND_STEP] Sending request to Groq API...")
        response = requests.post("https://api.groq.com/openai/v1/chat/completions", headers=headers, json=payload, timeout=30)
        response.raise_for_status()
        data = response.json()
        ai_response = data['choices'][0]['message']['content']
        print("[BACKEND_SUCCESS] AI response received")
        return {"response": ai_response}
    except Exception as e:
        print(f"[BACKEND_ERROR] chat_with_ai failed: {str(e)}")
        raise

__all__ = ["get_leads", "add_lead", "chat_with_ai"]
