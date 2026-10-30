import { useEffect, useState } from "react";
import { api, Profile } from "./api";
import { SignIn } from "./screens/SignIn";
import { Today } from "./screens/Today";
import { AddMeal } from "./screens/AddMeal";
import { Week } from "./screens/Week";
import { Settings } from "./screens/Settings";
import { utcDay } from "./dates";

type Screen = { name: "today"; day: string } | { name: "add"; day: string } | { name: "week" } | { name: "settings" };

export function App() {
  const [profile, setProfile] = useState<Profile | null | "loading">("loading");
  const [screen, setScreen] = useState<Screen>({ name: "today", day: utcDay() });

  useEffect(() => {
    api
      .me()
      .then(setProfile)
      .catch(() => setProfile(null));
  }, []);

  if (profile === "loading") return <main><p className="muted">Loading…</p></main>;
  if (profile === null) return <SignIn />;

  const activeTab = screen.name === "add" ? "today" : screen.name;
  return (
    <>
      <main>
        {screen.name === "today" && (
          <Today day={screen.day} onDayChange={(day) => setScreen({ name: "today", day })} onAdd={() => setScreen({ name: "add", day: screen.day })} />
        )}
        {screen.name === "add" && (
          <AddMeal day={screen.day} onDone={() => setScreen({ name: "today", day: screen.day })} onCancel={() => setScreen({ name: "today", day: screen.day })} />
        )}
        {screen.name === "week" && <Week onOpenDay={(day) => setScreen({ name: "today", day })} />}
        {screen.name === "settings" && <Settings profile={profile} onProfile={setProfile} onSignedOut={() => setProfile(null)} />}
      </main>
      <nav className="tabs" aria-label="Main">
        <a href="#today" className={activeTab === "today" ? "active" : ""} onClick={(e) => { e.preventDefault(); setScreen({ name: "today", day: utcDay() }); }}>Today</a>
        <a href="#week" className={activeTab === "week" ? "active" : ""} onClick={(e) => { e.preventDefault(); setScreen({ name: "week" }); }}>Week</a>
        <a href="#settings" className={activeTab === "settings" ? "active" : ""} onClick={(e) => { e.preventDefault(); setScreen({ name: "settings" }); }}>Settings</a>
      </nav>
    </>
  );
}
