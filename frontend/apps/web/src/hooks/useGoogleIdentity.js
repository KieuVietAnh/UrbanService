import { useEffect, useRef } from 'react';

let googleIdentityInitialized = false;

export function useGoogleIdentity(clientId, callback) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!clientId) return;
    if (googleIdentityInitialized || initialized.current) return;

    const initializeGoogle = () => {
      if (googleIdentityInitialized || initialized.current) return;
      if (!window.google?.accounts?.id) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback,
      });

      initialized.current = true;
      googleIdentityInitialized = true;
    };

    const scriptId = 'google-identity-script';
    let script = document.getElementById(scriptId);

    if (!script) {
      script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.id = scriptId;
      script.async = true;
      script.defer = true;
      script.addEventListener('load', initializeGoogle);
      document.head.appendChild(script);
    } else {
      if (window.google?.accounts?.id) {
        initializeGoogle();
      } else {
        script.addEventListener('load', initializeGoogle);
      }
    }

    return () => {
      if (script) {
        script.removeEventListener('load', initializeGoogle);
      }
    };
  }, [clientId, callback]);
}
