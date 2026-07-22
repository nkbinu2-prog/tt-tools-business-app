"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import styles from "./drive-entry.module.css";

type EntryType = "Expense" | "Income" | "Payment" | "Tool Movement" | "Note";
type LanguageCode = "en-IN" | "ml-IN";

type VoiceEntry = {
  id: string;
  type: EntryType;
  shop: string;
  amount: number | null;
  paymentMode: string;
  details: string;
  rawText: string;
  createdAt: string;
  status: "draft";
};

type SpeechAlternativeLike = {
  transcript: string;
  confidence?: number;
};

type SpeechResultLike = {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechAlternativeLike;
};

type SpeechResultListLike = {
  length: number;
  [index: number]: SpeechResultLike;
};

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechResultListLike;
};

type SpeechRecognitionErrorLike = {
  error: string;
  message?: string;
};

type BrowserSpeechRecognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition?: BrowserSpeechRecognitionConstructor;
    webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor;
  }
}

const STORAGE_KEY = "tt-tools-business-voice-inbox-v1";
const SHOPS = ["Not selected", "Karuvannur", "Ollur", "Kachery", "Mulayam Rd", "Pattikkad"];
const PAYMENT_MODES = ["Not selected", "Cash", "GPay / UPI", "Bank", "Card", "Staff Collection", "Other"];
const ENTRY_TYPES: EntryType[] = ["Expense", "Income", "Payment", "Tool Movement", "Note"];

const SHOP_ALIASES: Array<[string, string]> = [
  ["karuvannur", "Karuvannur"],
  ["karuvanoor", "Karuvannur"],
  ["കരുവന്നൂർ", "Karuvannur"],
  ["ollur", "Ollur"],
  ["ഒല്ലൂർ", "Ollur"],
  ["kachery", "Kachery"],
  ["kacheri", "Kachery"],
  ["കച്ചേരി", "Kachery"],
  ["mulayam road", "Mulayam Rd"],
  ["mulayam", "Mulayam Rd"],
  ["മുളയം", "Mulayam Rd"],
  ["pattikkad", "Pattikkad"],
  ["pattikad", "Pattikkad"],
  ["പട്ടിക്കാട്", "Pattikkad"],
];

const SMALL_NUMBERS: Record<string, number> = {
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
};

function containsAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function parseEnglishNumberWords(text: string): number | null {
  const words = text
    .toLowerCase()
    .replace(/-/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  let total = 0;
  let current = 0;
  let found = false;

  for (const word of words) {
    if (Object.prototype.hasOwnProperty.call(SMALL_NUMBERS, word)) {
      current += SMALL_NUMBERS[word];
      found = true;
      continue;
    }

    if (word === "hundred") {
      current = Math.max(current, 1) * 100;
      found = true;
      continue;
    }

    if (word === "thousand") {
      total += Math.max(current, 1) * 1_000;
      current = 0;
      found = true;
      continue;
    }

    if (word === "lakh" || word === "lakhs") {
      total += Math.max(current, 1) * 100_000;
      current = 0;
      found = true;
      continue;
    }
  }

  return found ? total + current : null;
}

function extractAmount(text: string): number | null {
  const digitMatches = [...text.matchAll(/(?:₹|rs\.?|rupees?)?\s*(\d[\d,]*(?:\.\d{1,2})?)/gi)];
  if (digitMatches.length > 0) {
    const raw = digitMatches[digitMatches.length - 1][1].replace(/,/g, "");
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  return parseEnglishNumberWords(text);
}

function detectType(text: string): EntryType {
  if (containsAny(text, ["tool movement", "movement", "transfer", "move tool", "shift tool", "ടൂൾ മാറ്റ", "മാറ്റുക"])) {
    return "Tool Movement";
  }
  if (containsAny(text, ["expense", "spent", "purchase", "diesel", "petrol", "fuel", "ചെലവ്", "ചിലവ്"])) {
    return "Expense";
  }
  if (containsAny(text, ["payment", "customer paid", "received payment", "collection", "പേയ്മെന്റ്", "പണം ലഭിച്ചു"])) {
    return "Payment";
  }
  if (containsAny(text, ["income", "received", "rent received", "വരുമാനം", "ലഭിച്ചു"])) {
    return "Income";
  }
  return "Note";
}

function detectShop(text: string): string {
  return SHOP_ALIASES.find(([alias]) => text.includes(alias))?.[1] ?? "Not selected";
}

function detectPaymentMode(text: string): string {
  if (containsAny(text, ["gpay", "google pay", "upi", "ജി പേ", "യുപിഐ"])) return "GPay / UPI";
  if (containsAny(text, ["cash", "ക്യാഷ്", "പണം"])) return "Cash";
  if (containsAny(text, ["bank", "transfer to bank"])) return "Bank";
  if (containsAny(text, ["card", "debit card", "credit card"])) return "Card";
  if (containsAny(text, ["staff collection", "staff collected"])) return "Staff Collection";
  return "Not selected";
}

function parseVoiceEntry(rawText: string): VoiceEntry {
  const normalized = rawText.toLowerCase().trim();
  return {
    id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
    type: detectType(normalized),
    shop: detectShop(normalized),
    amount: extractAmount(normalized),
    paymentMode: detectPaymentMode(normalized),
    details: rawText.trim(),
    rawText: rawText.trim(),
    createdAt: new Date().toISOString(),
    status: "draft",
  };
}

function formatMoney(amount: number | null) {
  if (amount === null) return "Amount not detected";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
  }).format(amount);
}

function entrySummary(entry: VoiceEntry) {
  const parts: string[] = [entry.type];
  if (entry.shop !== "Not selected") parts.push(`${entry.shop} shop`);
  if (entry.amount !== null) parts.push(`${entry.amount} rupees`);
  if (entry.paymentMode !== "Not selected") parts.push(entry.paymentMode);
  parts.push(entry.details);
  return parts.join(", ");
}

export default function DriveEntryPage() {
  const [language, setLanguage] = useState<LanguageCode>("en-IN");
  const [supported, setSupported] = useState(true);
  const [driveMode, setDriveMode] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [lastHeard, setLastHeard] = useState("");
  const [status, setStatus] = useState("Tap Start Drive Mode before you begin driving.");
  const [pending, setPending] = useState<VoiceEntry | null>(null);
  const [entries, setEntries] = useState<VoiceEntry[]>([]);

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const keepListeningRef = useRef(false);
  const speakingRef = useRef(false);
  const handlerRef = useRef<(text: string) => void>(() => undefined);
  const languageRef = useRef<LanguageCode>(language);

  useEffect(() => {
    languageRef.current = language;
    if (recognitionRef.current) recognitionRef.current.lang = language;
  }, [language]);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setEntries(JSON.parse(saved) as VoiceEntry[]);
    } catch {
      setStatus("The Voice Inbox could not be loaded on this device.");
    }
  }, []);

  const persistEntries = useCallback((nextEntries: VoiceEntry[]) => {
    setEntries(nextEntries);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(nextEntries));
    } catch {
      setStatus("The entry is visible now, but this browser could not store it permanently.");
    }
  }, []);

  const startRecognition = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition || speakingRef.current || !keepListeningRef.current) return;

    try {
      recognition.lang = languageRef.current;
      recognition.start();
      setIsListening(true);
      setStatus("Listening… Speak one complete entry.");
    } catch {
      // The browser throws when start() is called while recognition is already active.
    }
  }, []);

  const speak = useCallback(
    (message: string, resumeListening = true) => {
      if (!("speechSynthesis" in window)) {
        if (resumeListening) startRecognition();
        return;
      }

      speakingRef.current = true;
      try {
        recognitionRef.current?.stop();
      } catch {
        // Recognition may already be stopped.
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.lang = languageRef.current;
      utterance.rate = 0.94;
      utterance.onend = () => {
        speakingRef.current = false;
        if (resumeListening && keepListeningRef.current) {
          window.setTimeout(startRecognition, 350);
        }
      };
      utterance.onerror = () => {
        speakingRef.current = false;
        if (resumeListening && keepListeningRef.current) startRecognition();
      };
      window.speechSynthesis.speak(utterance);
    },
    [startRecognition],
  );

  const savePending = useCallback(
    (entry: VoiceEntry) => {
      const nextEntries = [entry, ...entries].slice(0, 100);
      persistEntries(nextEntries);
      setPending(null);
      setLiveTranscript("");
      setStatus("Saved safely in Voice Inbox as a draft.");
      speak("Saved in Voice Inbox. Say your next entry.");
    },
    [entries, persistEntries, speak],
  );

  const handleVoiceText = useCallback(
    (spokenText: string) => {
      const cleaned = spokenText.trim();
      if (!cleaned) return;

      setLastHeard(cleaned);
      setLiveTranscript("");
      const normalized = cleaned.toLowerCase();

      if (containsAny(normalized, ["stop drive mode", "stop listening", "drive mode off", "നിർത്തുക"])) {
        keepListeningRef.current = false;
        setDriveMode(false);
        setIsListening(false);
        setStatus("Drive Mode stopped.");
        try {
          recognitionRef.current?.stop();
        } catch {
          // Recognition may already be stopped.
        }
        speak("Drive Mode stopped.", false);
        return;
      }

      if (pending) {
        if (containsAny(normalized, ["save", "confirm", "yes save", "സേവ്", "ശരി", "സൂക്ഷിക്കുക"])) {
          savePending(pending);
          return;
        }

        if (containsAny(normalized, ["cancel", "discard", "do not save", "no save", "ക്യാൻസൽ", "റദ്ദാക്കുക", "വേണ്ട"])) {
          setPending(null);
          setStatus("Pending entry cancelled.");
          speak("Cancelled. Say a new entry.");
          return;
        }

        if (containsAny(normalized, ["repeat", "read again", "വീണ്ടും"])) {
          speak(`${entrySummary(pending)}. Say save or cancel.`);
          return;
        }

        if (containsAny(normalized, ["change amount", "amount is", "new amount"])) {
          const newAmount = extractAmount(normalized);
          if (newAmount !== null) {
            const changed = { ...pending, amount: newAmount };
            setPending(changed);
            setStatus(`Amount changed to ${formatMoney(newAmount)}.`);
            speak(`${entrySummary(changed)}. Say save or cancel.`);
          } else {
            speak("I could not detect the new amount. Please say change amount followed by the number.");
          }
          return;
        }

        speak("An entry is waiting. Say save, cancel, repeat, or change amount.");
        return;
      }

      const parsed = parseVoiceEntry(cleaned);
      setPending(parsed);
      setStatus("Entry understood. Check it or say Save.");
      speak(`${entrySummary(parsed)}. Say save or cancel.`);
    },
    [pending, savePending, speak],
  );

  useEffect(() => {
    handlerRef.current = handleVoiceText;
  }, [handleVoiceText]);

  useEffect(() => {
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setSupported(false);
      setStatus("Voice recognition is not supported in this browser. Use Chrome on Android or the installed app.");
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = languageRef.current;

    recognition.onresult = (event) => {
      let interim = "";
      let finalText = "";

      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += ` ${transcript}`;
        else interim += ` ${transcript}`;
      }

      setLiveTranscript(interim.trim());
      if (finalText.trim()) handlerRef.current(finalText.trim());
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        keepListeningRef.current = false;
        setDriveMode(false);
        setStatus("Microphone permission is blocked. Allow microphone access in Chrome settings.");
        return;
      }
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setStatus(`Voice recognition error: ${event.error}.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      if (keepListeningRef.current && !speakingRef.current) {
        window.setTimeout(startRecognition, 450);
      }
    };

    recognitionRef.current = recognition;

    return () => {
      keepListeningRef.current = false;
      try {
        recognition.abort();
      } catch {
        // Ignore browser cleanup errors.
      }
      window.speechSynthesis?.cancel();
    };
  }, [startRecognition]);

  const startDriveMode = useCallback(() => {
    if (!supported) return;
    keepListeningRef.current = true;
    setDriveMode(true);
    setStatus("Drive Mode is starting…");
    speak("Drive Mode started. Say an expense, income, payment, tool movement, or note.");
  }, [speak, supported]);

  const stopDriveMode = useCallback(() => {
    keepListeningRef.current = false;
    setDriveMode(false);
    setIsListening(false);
    setLiveTranscript("");
    try {
      recognitionRef.current?.stop();
    } catch {
      // Recognition may already be stopped.
    }
    window.speechSynthesis?.cancel();
    speakingRef.current = false;
    setStatus("Drive Mode stopped.");
  }, []);

  const updatePending = useCallback(<K extends keyof VoiceEntry>(field: K, value: VoiceEntry[K]) => {
    setPending((current) => (current ? { ...current, [field]: value } : current));
  }, []);

  const deleteEntry = useCallback(
    (id: string) => {
      persistEntries(entries.filter((entry) => entry.id !== id));
    },
    [entries, persistEntries],
  );

  const pendingAmount = pending?.amount === null || pending?.amount === undefined ? "" : String(pending.amount);

  const inboxCountText = useMemo(
    () => `${entries.length} draft${entries.length === 1 ? "" : "s"}`,
    [entries.length],
  );

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link href="/reminders" className={styles.backLink}>
          ← Back to Umbrella App
        </Link>
        <div>
          <p className={styles.eyebrow}>T&amp;T Tools Business</p>
          <h1>Hands-Free Drive Entry</h1>
          <p>Speak an entry, hear it read back, then say “Save” or “Cancel.”</p>
        </div>
        <label className={styles.languageBox}>
          Recognition language
          <select value={language} onChange={(event) => setLanguage(event.target.value as LanguageCode)}>
            <option value="en-IN">English / Mixed (India)</option>
            <option value="ml-IN">Malayalam</option>
          </select>
        </label>
      </header>

      <section className={styles.safetyNotice}>
        <strong>Driving safety:</strong> Start this mode before moving. Do not look at or touch the screen while driving. Entries are saved only as drafts for later review.
      </section>

      <section className={styles.driveConsole} aria-live="polite">
        <div className={`${styles.listeningOrb} ${isListening ? styles.listeningOrbActive : ""}`}>
          <span>{isListening ? "Listening" : driveMode ? "Ready" : "Stopped"}</span>
        </div>

        <div className={styles.consoleText}>
          <h2>{status}</h2>
          {liveTranscript ? <p className={styles.liveText}>Hearing: “{liveTranscript}”</p> : null}
          {lastHeard ? <p className={styles.lastText}>Last heard: “{lastHeard}”</p> : null}
          {!supported ? <p className={styles.errorText}>Open this page using Chrome on Android and allow microphone permission.</p> : null}
        </div>

        {!driveMode ? (
          <button className={styles.startButton} type="button" onClick={startDriveMode} disabled={!supported}>
            🎙️ Start Drive Mode
          </button>
        ) : (
          <button className={styles.stopButton} type="button" onClick={stopDriveMode}>
            ■ Stop Drive Mode
          </button>
        )}
      </section>

      <section className={styles.examples}>
        <h2>Example voice commands</h2>
        <div className={styles.exampleGrid}>
          <span>“Expense Ollur diesel 500 cash”</span>
          <span>“Payment from Linse 1000 GPay”</span>
          <span>“Move breaker from Ollur to Karuvannur”</span>
          <span>“Note call Foustin tomorrow”</span>
        </div>
      </section>

      {pending ? (
        <section className={styles.pendingCard}>
          <div className={styles.sectionHeading}>
            <div>
              <p className={styles.eyebrow}>Waiting for confirmation</p>
              <h2>Pending voice entry</h2>
            </div>
            <span>Say “Save” or “Cancel”</span>
          </div>

          <div className={styles.formGrid}>
            <label>
              Entry type
              <select value={pending.type} onChange={(event) => updatePending("type", event.target.value as EntryType)}>
                {ENTRY_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </label>

            <label>
              Shop
              <select value={pending.shop} onChange={(event) => updatePending("shop", event.target.value)}>
                {SHOPS.map((shop) => (
                  <option key={shop}>{shop}</option>
                ))}
              </select>
            </label>

            <label>
              Amount
              <input
                type="number"
                min="0"
                inputMode="decimal"
                value={pendingAmount}
                placeholder="Not detected"
                onChange={(event) => updatePending("amount", event.target.value === "" ? null : Number(event.target.value))}
              />
            </label>

            <label>
              Payment mode
              <select value={pending.paymentMode} onChange={(event) => updatePending("paymentMode", event.target.value)}>
                {PAYMENT_MODES.map((mode) => (
                  <option key={mode}>{mode}</option>
                ))}
              </select>
            </label>

            <label className={styles.detailsField}>
              Spoken details
              <textarea value={pending.details} onChange={(event) => updatePending("details", event.target.value)} rows={3} />
            </label>
          </div>

          <div className={styles.pendingActions}>
            <button type="button" className={styles.cancelButton} onClick={() => setPending(null)}>
              Cancel
            </button>
            <button type="button" className={styles.readButton} onClick={() => speak(`${entrySummary(pending)}. Say save or cancel.`)}>
              🔊 Read Back
            </button>
            <button type="button" className={styles.saveButton} onClick={() => savePending(pending)}>
              Save Draft
            </button>
          </div>
        </section>
      ) : null}

      <section className={styles.inboxCard}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.eyebrow}>Review when parked</p>
            <h2>Voice Inbox</h2>
          </div>
          <span>{inboxCountText}</span>
        </div>

        {entries.length === 0 ? (
          <div className={styles.emptyInbox}>No voice drafts saved yet.</div>
        ) : (
          <div className={styles.entryList}>
            {entries.map((entry) => (
              <article className={styles.entryItem} key={entry.id}>
                <div className={styles.entryTopLine}>
                  <strong>{entry.type}</strong>
                  <time>{new Date(entry.createdAt).toLocaleString("en-IN")}</time>
                </div>
                <div className={styles.entryMeta}>
                  <span>{entry.shop}</span>
                  <span>{formatMoney(entry.amount)}</span>
                  <span>{entry.paymentMode}</span>
                  <span>Draft</span>
                </div>
                <p>{entry.details}</p>
                <button type="button" onClick={() => deleteEntry(entry.id)} aria-label={`Delete ${entry.type} draft`}>
                  Delete draft
                </button>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
