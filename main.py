import os
import json
import subprocess

with open("products.json", "r") as f:
    products = json.load(f)
for pd in products:
    args = [pd['url']]
    print(args)

    # Ensure the arguments are strings, or convert them to strings
    process = subprocess.run(['node', 'polyperformance.js', *args], capture_output=True, text=True)

    # Check the result
    if process.returncode == 0:
        print('Node script executed successfully.')
        print('Output:', process.stdout)
    else:
        print('Node script failed with error code:', process.returncode)
        if process.stderr:
            print('Error output:', process.stderr)
    break