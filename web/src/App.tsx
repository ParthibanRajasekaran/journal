import { useEffect, useState } from "react";
import { api, ApiError, Profile } from "./api";
import { SignIn } from "./screens/SignIn";
import { Today } from "./screens/Today";
import { AddMeal } from "./screens/AddMeal";
import { Week } from "./screens/Week";
import { Settings } from "./screens/Settings";
import { localDay } from "./dates";

type Screen = { name: "today"; day: string } | { name: "add"; day: string } | { name: "week" } | { name: "settings" };
type Tab = "today" | "week" | "settings";
// "error" means the server could not be reached. Only a 401 means the user must sign in again.
type Loaded = Profile | null | "loading" | "error";

export function App() {
  const [profile, setProfile] = useState<Loaded>("loading");
  const [attempt, setAttempt] = useState(0);
  const [screen, setScreen] = useState<Screen>({ name: "today", day: localDay() });

  useEffect(() => {
    setProfile("loading");
    api
      .me()
      .then(setProfile)
      .catch((err: unknown) => {
        const signedOut = err instanceof ApiError && err.status === 401;
        setProfile(signedOut ? null : "error");
      });
  }, [attempt]);

  if (profile === "loading") {
    return (
      <main className="shell">
        <div className="skeleton" aria-label="Loading" />
      </main>
    );
  }
  if (profile === null) return <SignIn />;
  if (profile === "error") {
    return (
      <main className="shell">
        <section className="card load-error" role="alert">
          <p>Journal can't be reached right now. Check your connection, then try again.</p>
          <button className="primary" onClick={() => setAttempt((n) => n + 1)}>Try again</button>
        </section>
      </main>
    );
  }

  const tab: Tab = screen.name === "add" ? "today" : screen.name;
  const go = (next: Screen) => (event: React.MouseEvent) => {
    event.preventDefault();
    setScreen(next);
  };
  const todayNow = (): Screen => ({ name: "today", day: localDay() });
  const addNow = (): Screen => ({ name: "add", day: localDay() });

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <span className="brand">JOURNAL</span>
          <nav aria-label="Main">
            <a href="#today" className={tab === "today" ? "active" : ""} onClick={go(todayNow())}>Today</a>
            <a href="#week" className={tab === "week" ? "active" : ""} onClick={go({ name: "week" })}>Week</a>
            <a href="#settings" className={tab === "settings" ? "active" : ""} onClick={go({ name: "settings" })}>Settings</a>
          </nav>
          <button className="primary" onClick={() => setScreen(addNow())}>+ Add meal</button>
          <button
            className="ghost"
            onClick={() => {
              api.logout().finally(() => setProfile(null));
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="shell">
        <div key={screen.name === "today" ? `today-${screen.day}` : screen.name} className="screen">
          {screen.name === "today" && (
            <Today day={screen.day} onDayChange={(day) => setScreen({ name: "today", day })} onAdd={() => setScreen({ name: "add", day: screen.day })} />
          )}
          {screen.name === "add" && (
            <AddMeal day={screen.day} onDone={() => setScreen({ name: "today", day: screen.day })} onCancel={() => setScreen({ name: "today", day: screen.day })} />
          )}
          {screen.name === "week" && <Week onOpenDay={(day) => setScreen({ name: "today", day })} />}
          {screen.name === "settings" && <Settings profile={profile} onProfile={setProfile} onSignedOut={() => setProfile(null)} />}
        </div>
      </main>

      <nav className="tabs" aria-label="Main mobile">
        <a href="#today" className={tab === "today" ? "active" : ""} onClick={go(todayNow())}>Today</a>
        <a href="#week" className={tab === "week" ? "active" : ""} onClick={go({ name: "week" })}>Week</a>
        <a href="#add" className="tab-add" onClick={go(addNow())}>+ Add</a>
        <a href="#settings" className={tab === "settings" ? "active" : ""} onClick={go({ name: "settings" })}>Settings</a>
      </nav>
    </>
  );
}
