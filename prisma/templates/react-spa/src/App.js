import React from "react";
import { Route, Switch, useHistory } from "react-router-dom";
import { OktaAuth, toRelativeUrl } from "@okta/okta-auth-js";
import { Security, LoginCallback, useOktaAuth } from "@okta/okta-react";
import { env } from "./env";

const oktaAuth = new OktaAuth({
  issuer: env.issuer,
  clientId: env.clientId,
  redirectUri: window.location.origin + "/login/callback",
  scopes: ["openid", "profile", "email"],
  pkce: true,
});

function Home() {
  const { authState, oktaAuth } = useOktaAuth();
  const [user, setUser] = React.useState(null);

  React.useEffect(() => {
    if (authState && authState.isAuthenticated) oktaAuth.getUser().then(setUser);
  }, [authState, oktaAuth]);

  if (!authState) return <p className="muted">Loading…</p>;
  if (authState.error) return <div className="error">{String(authState.error)}</div>;
  if (!authState.isAuthenticated)
    return (
      <>
        <p className="muted">You are signed out. Sign in to see the ID token claims.</p>
        <button className="btn" onClick={() => oktaAuth.signInWithRedirect()}>
          Sign in with Okta
        </button>
      </>
    );
  return (
    <>
      <div className="row">
        <span className="status">Signed in{user && user.email ? " as " + user.email : ""}</span>
        <button className="btn secondary" onClick={() => oktaAuth.signOut()}>
          Sign out
        </button>
      </div>
      <pre>{JSON.stringify(user, null, 2)}</pre>
    </>
  );
}

export default function App() {
  const history = useHistory();
  const restoreOriginalUri = async (_oktaAuth, originalUri) => {
    history.replace(toRelativeUrl(originalUri || "/", window.location.origin));
  };
  return (
    <Security oktaAuth={oktaAuth} restoreOriginalUri={restoreOriginalUri}>
      <div className="shell">
        <div className="card">
          <span className="badge">@okta/okta-react</span>
          <h1>Okta React SDK</h1>
          <Switch>
            <Route path="/login/callback" component={LoginCallback} />
            <Route path="/" component={Home} />
          </Switch>
        </div>
      </div>
    </Security>
  );
}
