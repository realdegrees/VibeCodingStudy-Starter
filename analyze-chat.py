"""
Analyzes aggregated chat data and generates CSV with metrics.
"""

import json
import pandas as pd
import numpy as np
from datetime import datetime
from typing import List, Dict, Any, Optional


INPUT_FILE = "aggregated-chat.json"
OUTPUT_FILE = "chat-metrics.csv"


def analyze_chat_data(conversations: List[Dict[str, Any]]) -> pd.DataFrame:
    """Analyzes conversation data and computes comprehensive metrics."""
    
    if not conversations:
        return pd.DataFrame({"Metric": ["Total Prompts"], "Value": [0]})
    
    # Convert to DataFrame
    df = pd.DataFrame(conversations)
    
    # Parse timestamps (they are in milliseconds, so divide by 1000 then convert)
    df["promptTimestamp"] = pd.to_datetime(df["promptTimestamp"], unit="ms", errors="coerce")
    df["responseCompletedTimestamp"] = pd.to_datetime(df["responseCompletedTimestamp"], unit="ms", errors="coerce")
    
    # Calculate text lengths
    df["promptLength"] = df["userPrompt"].str.len()
    df["responseLength"] = df["finalResponse"].str.len()
    df["totalLength"] = df["promptLength"] + df["responseLength"]
    
    # Calculate response durations (time from prompt to response completion)
    df["responseDuration"] = (df["responseCompletedTimestamp"] - df["promptTimestamp"]).dt.total_seconds()
    
    # Calculate time between prompts (time from previous response completion to next prompt)
    df["timeBetweenPrompts"] = (df["promptTimestamp"] - df["responseCompletedTimestamp"].shift(1)).dt.total_seconds()
    
    # Calculate total session duration
    total_duration = None
    if df["promptTimestamp"].notna().any() and df["responseCompletedTimestamp"].notna().any():
        first_prompt = df["promptTimestamp"].min()
        last_response = df["responseCompletedTimestamp"].max()
        if pd.notna(first_prompt) and pd.notna(last_response):
            total_duration = (last_response - first_prompt).total_seconds()
    
    # Filter valid response durations for statistics
    valid_durations = df["responseDuration"].dropna()
    valid_gaps = df["timeBetweenPrompts"].dropna()
    
    # Compile comprehensive metrics
    metrics = []
    
    # Session-level metrics
    metrics.append(("Total Prompts", len(df)))
    metrics.append(("Total Session Duration (seconds)", round(total_duration, 2) if total_duration else None))
    metrics.append(("Total Session Duration (minutes)", round(total_duration / 60, 2) if total_duration else None))
    metrics.append(("Session Start Time", df["promptTimestamp"].min().isoformat() if df["promptTimestamp"].notna().any() else None))
    metrics.append(("Session End Time", df["responseCompletedTimestamp"].max().isoformat() if df["responseCompletedTimestamp"].notna().any() else None))
    
    # Response duration statistics
    metrics.append(("Average Response Duration (seconds)", round(valid_durations.mean(), 2) if len(valid_durations) > 0 else None))
    metrics.append(("Median Response Duration (seconds)", round(valid_durations.median(), 2) if len(valid_durations) > 0 else None))
    metrics.append(("Std Dev Response Duration (seconds)", round(valid_durations.std(), 2) if len(valid_durations) > 0 else None))
    metrics.append(("Min Response Duration (seconds)", round(valid_durations.min(), 2) if len(valid_durations) > 0 else None))
    metrics.append(("Max Response Duration (seconds)", round(valid_durations.max(), 2) if len(valid_durations) > 0 else None))
    metrics.append(("25th Percentile Response Duration (seconds)", round(valid_durations.quantile(0.25), 2) if len(valid_durations) > 0 else None))
    metrics.append(("75th Percentile Response Duration (seconds)", round(valid_durations.quantile(0.75), 2) if len(valid_durations) > 0 else None))
    metrics.append(("95th Percentile Response Duration (seconds)", round(valid_durations.quantile(0.95), 2) if len(valid_durations) > 0 else None))
    
    # Time between prompts statistics
    metrics.append(("Average Time Between Prompts (seconds)", round(valid_gaps.mean(), 2) if len(valid_gaps) > 0 else None))
    metrics.append(("Median Time Between Prompts (seconds)", round(valid_gaps.median(), 2) if len(valid_gaps) > 0 else None))
    metrics.append(("Std Dev Time Between Prompts (seconds)", round(valid_gaps.std(), 2) if len(valid_gaps) > 0 else None))
    metrics.append(("Min Time Between Prompts (seconds)", round(valid_gaps.min(), 2) if len(valid_gaps) > 0 else None))
    metrics.append(("Max Time Between Prompts (seconds)", round(valid_gaps.max(), 2) if len(valid_gaps) > 0 else None))
    
    # Throughput metrics
    if total_duration and total_duration > 0:
        metrics.append(("Prompts Per Hour", round(len(df) / (total_duration / 3600), 2)))
        metrics.append(("Responses Per Minute", round(len(df) / (total_duration / 60), 2)))
    else:
        metrics.append(("Prompts Per Hour", None))
        metrics.append(("Responses Per Minute", None))
    
    # Text length statistics - Prompts
    metrics.append(("Average Prompt Length (chars)", round(df["promptLength"].mean(), 2)))
    metrics.append(("Median Prompt Length (chars)", round(df["promptLength"].median(), 2)))
    metrics.append(("Std Dev Prompt Length (chars)", round(df["promptLength"].std(), 2)))
    metrics.append(("Min Prompt Length (chars)", int(df["promptLength"].min())))
    metrics.append(("Max Prompt Length (chars)", int(df["promptLength"].max())))
    metrics.append(("Total Prompt Characters", int(df["promptLength"].sum())))
    
    # Text length statistics - Responses
    metrics.append(("Average Response Length (chars)", round(df["responseLength"].mean(), 2)))
    metrics.append(("Median Response Length (chars)", round(df["responseLength"].median(), 2)))
    metrics.append(("Std Dev Response Length (chars)", round(df["responseLength"].std(), 2)))
    metrics.append(("Min Response Length (chars)", int(df["responseLength"].min())))
    metrics.append(("Max Response Length (chars)", int(df["responseLength"].max())))
    metrics.append(("Total Response Characters", int(df["responseLength"].sum())))
    
    # Combined text metrics
    metrics.append(("Total Characters Processed", int(df["totalLength"].sum())))
    metrics.append(("Average Total Exchange Length (chars)", round(df["totalLength"].mean(), 2)))
    metrics.append(("Response to Prompt Length Ratio", round(df["responseLength"].mean() / df["promptLength"].mean(), 2)))
    
    # Context references statistics
    metrics.append(("Total Context References", int(df["contextReferencesCount"].sum())))
    metrics.append(("Average Context References Per Prompt", round(df["contextReferencesCount"].mean(), 2)))
    metrics.append(("Median Context References Per Prompt", round(df["contextReferencesCount"].median(), 2)))
    metrics.append(("Max Context References in Single Prompt", int(df["contextReferencesCount"].max())))
    metrics.append(("Prompts With Context References", int((df["contextReferencesCount"] > 0).sum())))
    metrics.append(("Prompts Without Context References", int((df["contextReferencesCount"] == 0).sum())))
    metrics.append(("Percentage Prompts With Context", round((df["contextReferencesCount"] > 0).mean() * 100, 2)))
    
    # Efficiency metrics
    if len(valid_durations) > 0:
        metrics.append(("Characters Per Second (Response Generation)", round(df["responseLength"].sum() / valid_durations.sum(), 2)))
        metrics.append(("Average Response Speed (chars/sec)", round(df["responseLength"].mean() / valid_durations.mean(), 2)))
    else:
        metrics.append(("Characters Per Second (Response Generation)", None))
        metrics.append(("Average Response Speed (chars/sec)", None))
    
    # Additional metrics from raw data (if available)
    if "firstProgressTime" in df.columns:
        valid_first_progress = df["firstProgressTime"].dropna()
        if len(valid_first_progress) > 0:
            metrics.append(("Average Time to First Progress (ms)", round(valid_first_progress.mean(), 2)))
            metrics.append(("Median Time to First Progress (ms)", round(valid_first_progress.median(), 2)))
    
    if "totalElapsedTime" in df.columns:
        valid_total_elapsed = df["totalElapsedTime"].dropna()
        if len(valid_total_elapsed) > 0:
            metrics.append(("Average Total Elapsed Time (ms)", round(valid_total_elapsed.mean(), 2)))
            metrics.append(("Total Processing Time (seconds)", round(valid_total_elapsed.sum() / 1000, 2)))
    
    if "timeSpentWaiting" in df.columns:
        total_waiting = df["timeSpentWaiting"].sum()
        if total_waiting > 0:
            metrics.append(("Total Time Spent Waiting (ms)", int(total_waiting)))
            metrics.append(("Total Time Spent Waiting (seconds)", round(total_waiting / 1000, 2)))
            metrics.append(("Average Time Spent Waiting Per Request (ms)", round(df["timeSpentWaiting"].mean(), 2)))
    
    # Model usage statistics
    if "modelId" in df.columns:
        model_counts = df["modelId"].value_counts()
        unique_models = df["modelId"].nunique()
        
        metrics.append(("--- Model Usage Statistics ---", ""))
        metrics.append(("Unique Models Used", int(unique_models)))
        
        for idx, (model, count) in enumerate(model_counts.items(), 1):
            model_name = model if model else "Unknown"
            percentage = (count / len(df)) * 100
            metrics.append((f"Model {idx}: {model_name}", f"{int(count)} requests ({round(percentage, 1)}%)"))
            
            # Calculate average response time for this model
            model_df = df[df["modelId"] == model]
            model_durations = model_df["responseDuration"].dropna()
            if len(model_durations) > 0:
                metrics.append((f"  → Avg Response Time", f"{round(model_durations.mean(), 2)} sec"))
                metrics.append((f"  → Avg Response Length", f"{round(model_df['responseLength'].mean(), 2)} chars"))
    
    if "contentReferencesCount" in df.columns:
        metrics.append(("Total Content References", int(df["contentReferencesCount"].sum())))
        metrics.append(("Average Content References Per Request", round(df["contentReferencesCount"].mean(), 2)))
    
    if "codeCitationsCount" in df.columns:
        total_citations = df["codeCitationsCount"].sum()
        if total_citations > 0:
            metrics.append(("Total Code Citations", int(total_citations)))
            metrics.append(("Average Code Citations Per Request", round(df["codeCitationsCount"].mean(), 2)))
    
    return pd.DataFrame(metrics, columns=["Metric", "Value"])


def main() -> None:
    """Main execution function."""
    try:
        print(f"Reading aggregated data from: {INPUT_FILE}")
        with open(INPUT_FILE, "r", encoding="utf-8") as f:
            conversations = json.load(f)
        
        print("Analyzing chat data...")
        metrics_df = analyze_chat_data(conversations)
        
        print(f"Writing metrics to: {OUTPUT_FILE}")
        metrics_df.to_csv(OUTPUT_FILE, index=False)
        
        print("\nSuccess! Metrics generated:")
        print(metrics_df.to_string(index=False))
        
    except FileNotFoundError as e:
        print(f"Error: File not found - {e.filename}")
        print("Make sure to run aggregate-chat.js first to generate aggregated-chat.json")
    except json.JSONDecodeError as e:
        print(f"Error: Invalid JSON in input file - {e}")
    except Exception as e:
        print(f"Error: {e}")


if __name__ == "__main__":
    main()
