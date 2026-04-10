FROM mcr.microsoft.com/azure-functions/python:4-python3.11

ENV AzureWebJobsScriptRoot=/home/site/wwwroot \
    AzureFunctionsJobHost__Logging__Console__IsEnabled=true

COPY requirements.txt /home/site/wwwroot/
RUN pip install --no-cache-dir -r /home/site/wwwroot/requirements.txt

COPY host.json /home/site/wwwroot/
COPY function_app.py /home/site/wwwroot/

# Note: Using Python 3.13 base image. Upgrade to 3.14 when
# mcr.microsoft.com/azure-functions/python:4-python3.14 is available.
# Track: https://github.com/Azure/azure-functions-python-worker/issues
