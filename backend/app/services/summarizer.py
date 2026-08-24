import json
from groq import Groq
from app import config

async def summarize_transcript(transcript_text: str, custom_api_key: str = None) -> dict:
    """
    Summarizes meeting transcript using Groq's LLM (llama-3.1-70b-versatile).
    Returns a dictionary matching the schema:
    {
        "summary": "...",
        "decisions": ["...", "..."],
        "action_items": [{"task": "...", "owner": "...", "due_date": "..."}]
    }
    """
    api_key = custom_api_key or config.GROQ_API_KEY
    if not api_key:
        raise ValueError("Groq API Key is missing. Please set it in your .env or settings panel.")
        
    client = Groq(api_key=api_key)
    
    system_prompt = (
        "You are an expert AI meeting assistant. Your task is to analyze raw meeting transcripts "
        "and convert them into highly structured, action-oriented summaries. "
        "You must return a valid JSON object matching this exact schema:\n"
        "{\n"
        '  "summary": "A clean, concise 2-3 paragraph summary of the meeting highlights and context.",\n'
        '  "decisions": ["Decision 1", "Decision 2", ...],\n'
        '  "action_items": [\n'
        '    {\n'
        '      "task": "Specific task description",\n'
        '      "owner": "Name of owner if mentioned, otherwise null",\n'
        '      "due_date": "Due date if mentioned, otherwise null"\n'
        "    }\n"
        "  ]\n"
        "}\n\n"
        "Rules:\n"
        "1. Do not invent or hallucinate decisions, tasks, owners, or dates not in the transcript.\n"
        "2. If an owner is not mentioned for a task, set the owner to null (JSON null).\n"
        "3. If a due date is not mentioned, set the due_date to null.\n"
        "4. Your response MUST contain ONLY the JSON object. Do not include any intro, outro, or markdown formatting blocks (like ```json)."
    )
    
    user_prompt = f"Please summarize the following meeting transcript:\n\n{transcript_text}"
    
    try:
        # Use Groq LLM (groq/compound supports JSON mode)
        chat_completion = client.chat.completions.create(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ],
            model="groq/compound",
            temperature=0.1,  # Low temperature for more analytical and structured output
            response_format={"type": "json_object"}  # Request JSON Mode
        )
        
        response_content = chat_completion.choices[0].message.content
        summary_data = json.loads(response_content)
        
        # Validate keys and types
        if "summary" not in summary_data:
            summary_data["summary"] = "No summary generated."
        if "decisions" not in summary_data or not isinstance(summary_data["decisions"], list):
            summary_data["decisions"] = []
        if "action_items" not in summary_data or not isinstance(summary_data["action_items"], list):
            summary_data["action_items"] = []
            
        return summary_data
        
    except json.JSONDecodeError as je:
        print(f"JSON parsing error: {je}. Raw response was: {response_content}")
        # Return fallback values
        return {
            "summary": "Error parsing summary data from model.",
            "decisions": ["Could not parse decisions"],
            "action_items": []
        }
    except Exception as e:
        print(f"Error during summarization: {e}")
        raise e
