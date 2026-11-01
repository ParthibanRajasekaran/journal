package com.journal.googleauth;

import android.app.Activity;
import android.os.CancellationSignal;
import androidx.core.content.ContextCompat;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.android.libraries.identity.googleid.GetGoogleIdOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;

// Google-only sign-in through Android Credential Manager. Resolves with the ID token. Errors are rejected with
// the codes USER_CANCELLED, NOT_CONFIGURED, UNAVAILABLE or FAILED, matching the iOS plugin.
@CapacitorPlugin(name = "JournalGoogleAuth")
public class JournalGoogleAuthPlugin extends Plugin {

    @PluginMethod
    public void login(PluginCall call) {
        String nonce = call.getString("nonce");
        String webClientId = call.getString("webClientId");
        if (nonce == null || nonce.isEmpty()) {
            call.reject("nonce is required", "FAILED");
            return;
        }
        if (webClientId == null || webClientId.isEmpty()) {
            call.reject("webClientId is not configured for this build", "NOT_CONFIGURED");
            return;
        }
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity is available to present sign-in", "UNAVAILABLE");
            return;
        }

        GetGoogleIdOption option = new GetGoogleIdOption.Builder()
            .setFilterByAuthorizedAccounts(false)
            .setServerClientId(webClientId)
            .setNonce(nonce)
            .setAutoSelectEnabled(false)
            .build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();

        CredentialManager.create(activity).getCredentialAsync(
            activity,
            request,
            new CancellationSignal(),
            ContextCompat.getMainExecutor(activity),
            new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
                @Override
                public void onResult(GetCredentialResponse response) {
                    try {
                        GoogleIdTokenCredential google = GoogleIdTokenCredential.createFrom(response.getCredential().getData());
                        String idToken = google.getIdToken();
                        if (idToken == null || idToken.isEmpty()) {
                            call.reject("Google returned no ID token", "FAILED");
                            return;
                        }
                        JSObject result = new JSObject();
                        result.put("idToken", idToken);
                        call.resolve(result);
                    } catch (RuntimeException e) {
                        // A credential that is not a Google ID token, or that cannot be parsed, is a failure, never a sign-in.
                        call.reject("Google returned a credential that is not an ID token", "FAILED");
                    }
                }

                @Override
                public void onError(GetCredentialException e) {
                    if (e instanceof GetCredentialCancellationException) {
                        call.reject("sign-in was cancelled", "USER_CANCELLED");
                    } else {
                        call.reject(e.getMessage() == null ? "sign-in failed" : e.getMessage(), "FAILED");
                    }
                }
            }
        );
    }
}
