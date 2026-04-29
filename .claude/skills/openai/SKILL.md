---
name: openai-inference
description: Use this to write code to call an LLM using the OpenAI Python SDK with the GPT-5.4 mini model
---

# Calling an LLM via OpenAI

These instructions allow you to write code to call an LLM with the OpenAI Python SDK.  
This method uses the GPT-5.4 mini model.

## Setup

The OPENAI_API_KEY must be set in the .env file and loaded in as an environment variable.  

The uv project must include openai and pydantic.
`uv add openai pydantic`

## Code snippets

Use code like these examples in order to use OpenAI.

### Imports and constants

```python
from openai import OpenAI

client = OpenAI()
MODEL = "gpt-5.4-mini"
```

### Code to call via OpenAI for a text response

```python
response = client.responses.create(model=MODEL, input=messages)
result = response.output_text
```

### Code to call via OpenAI for a Structured Outputs response

```python
response = client.responses.parse(model=MODEL, input=messages, text_format=MyBaseModelSubclass)
result_as_object = response.output_parsed
```