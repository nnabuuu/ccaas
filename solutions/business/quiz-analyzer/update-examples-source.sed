# Add source field to all knowledge point tags in examples
s/"path": \[\([^]]*\)\]/"path": [\1],\n      "source": "question"/g
