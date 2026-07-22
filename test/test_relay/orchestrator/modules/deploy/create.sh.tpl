#!/usr/bin/env sh
DIR=$(pwd)

CREATE_AFTER_PERSIST=$1

echo "[ORCHESTRATOR DEBUG] create.sh started. DIR=$DIR, CREATE_AFTER_PERSIST=$CREATE_AFTER_PERSIST"

# Add ~/bin to PATH for age and aws
export PATH="$${HOME}/bin:$PATH"
echo "[ORCHESTRATOR DEBUG] PATH updated: $PATH"

# Handle age decryption if needed
SECRETS_DECRYPTED=0
if [ -n "$AGE_KEY_PATH" ] && [ -n "$SECRETS_PATH" ] && [ -f "$AGE_KEY_PATH" ] && [ -f "$SECRETS_PATH" ]; then
  DECRYPTED_SECRETS="/tmp/secrets.rc"
  echo "[ORCHESTRATOR DEBUG] Decrypting secrets with age. KEY=$AGE_KEY_PATH, SECRETS=$SECRETS_PATH"

  age -d -i "$AGE_KEY_PATH" -o "$DECRYPTED_SECRETS" "$SECRETS_PATH"
  if [ -f "$DECRYPTED_SECRETS" ]; then
    echo "[ORCHESTRATOR DEBUG] Decryption successful. Sourcing $DECRYPTED_SECRETS..."
    chmod +x "$DECRYPTED_SECRETS"
    # shellcheck disable=SC1090
    . "$DECRYPTED_SECRETS"
    SECRETS_DECRYPTED=1
  else
    echo "[ORCHESTRATOR DEBUG] Failed to decrypt secrets"
    exit 1
  fi
else
  echo "[ORCHESTRATOR DEBUG] No secrets to decrypt. AGE_KEY_PATH=$AGE_KEY_PATH, SECRETS_PATH=$SECRETS_PATH"
  exit 1
fi

# shellcheck disable=SC2154
echo "[ORCHESTRATOR DEBUG] Changing directory to deploy_path: ${deploy_path}"
cd "${deploy_path}" || exit

if [ -f ./envrc ]; then
  echo "[ORCHESTRATOR DEBUG] Sourcing ./envrc..."
  # shellcheck disable=SC1091
  . ./envrc
else
  echo "[ORCHESTRATOR DEBUG] Can't find envrc..."
  if [ $SECRETS_DECRYPTED -eq 1 ]; then rm -f "$DECRYPTED_SECRETS"; fi
  exit 1
fi

# Set up plugin cache directory
echo "[ORCHESTRATOR DEBUG] Setting up plugin cache directory..."
mkdir -p "$HOME/.terraform.d/plugin-cache"
export TF_PLUGIN_CACHE_DIR="$HOME/.terraform.d/plugin-cache"
export TF_IN_AUTOMATION=1

echo "[ORCHESTRATOR DEBUG] Running terraform version:"
terraform version

# shellcheck disable=SC2034
TF_CLI_ARGS_init=""
# shellcheck disable=SC2034
TF_CLI_ARGS_apply=""

if [ -z "$CREATE_AFTER_PERSIST" ]; then
  echo "[ORCHESTRATOR DEBUG] CREATE_AFTER_PERSIST is empty, running init_script..."
  # shellcheck disable=SC2154
  ${init_script}
  echo "[ORCHESTRATOR DEBUG] init_script complete."
else
  echo "[ORCHESTRATOR DEBUG] CREATE_AFTER_PERSIST is set ($CREATE_AFTER_PERSIST), skipping init_script."
fi

# shellcheck disable=SC2154
MAX=${attempts}
EXITCODE=1
ATTEMPTS=0
echo "[ORCHESTRATOR DEBUG] Initializing loop variables. MAX=$MAX, ATTEMPTS=$ATTEMPTS, EXITCODE=$EXITCODE"

while [ $EXITCODE -gt 0 ] && [ $ATTEMPTS -lt "$MAX" ]; do
  E=1
  E1=0
  A=0
  echo "[ORCHESTRATOR DEBUG] [OUTER LOOP] Iteration ATTEMPTS=$ATTEMPTS. Resetting E=$E, E1=$E1, A=$A"
  
  while [ $E -gt 0 ] && [ $A -lt "$MAX" ]; do
    echo "[ORCHESTRATOR DEBUG] [INNER APPLY LOOP] Iteration A=$A. Running terraform apply..."
    # shellcheck disable=SC2154
    timeout -k 1m "${timeout}" terraform apply -var-file="inputs.tfvars" -no-color -auto-approve -state="tfstate"
    E=$?
    echo "[ORCHESTRATOR DEBUG] [INNER APPLY LOOP] terraform apply completed with exit code: $E"
    if [ $E -eq 124 ]; then echo "[ORCHESTRATOR DEBUG] [INNER APPLY LOOP] Apply timed out after ${timeout}"; fi
    A=$((A+1))
  done
  
  # don't destroy if the last attempt fails
  if [ $E -gt 0 ] && [ $ATTEMPTS != $((MAX-1)) ]; then
    echo "[ORCHESTRATOR DEBUG] Apply failed and this is not the last outer attempt (ATTEMPTS=$ATTEMPTS, MAX=$MAX). Running destroy..."
    A1=0
    E1=1
    while [ $E1 -gt 0 ] && [ $A1 -lt "$MAX" ]; do
      echo "[ORCHESTRATOR DEBUG] [INNER DESTROY LOOP] Iteration A1=$A1. Running terraform destroy..."
      timeout -k 1m "${timeout}" terraform destroy -var-file="inputs.tfvars" -no-color -auto-approve -state="tfstate"
      E1=$?
      echo "[ORCHESTRATOR DEBUG] [INNER DESTROY LOOP] terraform destroy completed with exit code: $E1"
      if [ $E1 -eq 124 ]; then echo "[ORCHESTRATOR DEBUG] [INNER DESTROY LOOP] Destroy timed out after ${timeout}"; fi
      A1=$((A1+1))
    done
  fi
  
  if [ $E -gt 0 ]; then
    echo "[ORCHESTRATOR DEBUG] Apply failed..."
  fi
  if [ $E1 -gt 0 ]; then
    echo "[ORCHESTRATOR DEBUG] Destroy failed..."
  fi
  
  if [ $E -gt 0 ] || [ $E1 -gt 0 ]; then
    EXITCODE=1
    echo "[ORCHESTRATOR DEBUG] Setting EXITCODE=1 (apply or destroy failed)"
  else
    EXITCODE=0
    echo "[ORCHESTRATOR DEBUG] Setting EXITCODE=0 (both apply and destroy succeeded/no-oped)"
  fi
  
  ATTEMPTS=$((ATTEMPTS+1))
  echo "[ORCHESTRATOR DEBUG] Incrementing ATTEMPTS to $ATTEMPTS"
  
  if [ $EXITCODE -gt 0 ] && [ $ATTEMPTS -lt "$MAX" ]; then
    # shellcheck disable=SC2154
    echo "[ORCHESTRATOR DEBUG] Retrying loop. Waiting ${interval} seconds between attempts..."
    # shellcheck disable=SC2154
    sleep "${interval}"
  fi
done

echo "[ORCHESTRATOR DEBUG] Loop exited. Final ATTEMPTS=$ATTEMPTS, EXITCODE=$EXITCODE"

if [ $ATTEMPTS -eq "$MAX" ]; then echo "[ORCHESTRATOR DEBUG] Max attempts reached..."; fi
if [ $EXITCODE -ne 0 ]; then echo "[ORCHESTRATOR DEBUG] Failure, exit code $EXITCODE..."; fi

if [ $EXITCODE -eq 0 ]; then
  echo "[ORCHESTRATOR DEBUG] Success! Generating outputs.json..."
  terraform output -json -state="tfstate" > outputs.json
  echo "[ORCHESTRATOR DEBUG] outputs.json generated successfully."
fi

# Cleanup decrypted secrets
if [ $SECRETS_DECRYPTED -eq 1 ] && [ -f "$DECRYPTED_SECRETS" ]; then
  echo "[ORCHESTRATOR DEBUG] Cleaning up decrypted secrets: $DECRYPTED_SECRETS"
  rm -f "$DECRYPTED_SECRETS"
fi

echo "[ORCHESTRATOR DEBUG] Restoring directory to $DIR and exiting with code $EXITCODE."
cd "$DIR" || exit
exit $EXITCODE
