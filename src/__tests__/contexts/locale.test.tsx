/**
 * @jest-environment jsdom
 */
import { render, screen, act } from "@testing-library/react";
import { LocaleProvider, useLocale } from "@/contexts/locale";

function TestConsumer() {
  const { locale, t, setLocale } = useLocale();
  return (
    <div>
      <span data-testid="locale">{locale}</span>
      <span data-testid="translation">{t("orders")}</span>
      <button onClick={() => setLocale("ur")}>Switch to Urdu</button>
      <button onClick={() => setLocale("en")}>Switch to English</button>
    </div>
  );
}

describe("LocaleProvider", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("defaults to English locale", () => {
    render(<LocaleProvider><TestConsumer /></LocaleProvider>);
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });

  it("t() returns an English string by default", () => {
    render(<LocaleProvider><TestConsumer /></LocaleProvider>);
    const translation = screen.getByTestId("translation").textContent;
    expect(typeof translation).toBe("string");
    expect(translation!.length).toBeGreaterThan(0);
  });

  it("persists locale to localStorage when changed", async () => {
    render(<LocaleProvider><TestConsumer /></LocaleProvider>);
    await act(async () => {
      screen.getByText("Switch to Urdu").click();
    });
    expect(localStorage.getItem("locale")).toBe("ur");
  });

  it("updates the locale state when setLocale is called", async () => {
    render(<LocaleProvider><TestConsumer /></LocaleProvider>);
    await act(async () => {
      screen.getByText("Switch to Urdu").click();
    });
    expect(screen.getByTestId("locale").textContent).toBe("ur");
  });

  it("restores locale from localStorage on mount", async () => {
    localStorage.setItem("locale", "ur");
    render(<LocaleProvider><TestConsumer /></LocaleProvider>);
    // Wait for useEffect to run
    await act(async () => {});
    expect(screen.getByTestId("locale").textContent).toBe("ur");
  });

  it("ignores invalid localStorage values", async () => {
    localStorage.setItem("locale", "fr");
    render(<LocaleProvider><TestConsumer /></LocaleProvider>);
    await act(async () => {});
    expect(screen.getByTestId("locale").textContent).toBe("en");
  });
});
