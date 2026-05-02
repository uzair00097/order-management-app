/**
 * @jest-environment jsdom
 */
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "@/contexts/toast";

function TestConsumer({ message = "Hello", type }: { message?: string; type?: "success" | "error" | "info" }) {
  const { show } = useToast();
  return <button onClick={() => show(message, type)}>Show Toast</button>;
}

function Wrapper({ message, type }: { message?: string; type?: "success" | "error" | "info" }) {
  return (
    <ToastProvider>
      <TestConsumer message={message} type={type} />
    </ToastProvider>
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    act(() => { jest.runOnlyPendingTimers(); });
    jest.useRealTimers();
  });

  it("shows a toast when show() is called", async () => {
    render(<Wrapper message="Order saved" />);
    await act(async () => {
      screen.getByText("Show Toast").click();
    });
    expect(screen.getByText("Order saved")).toBeInTheDocument();
  });

  it("removes the toast after 3500ms", async () => {
    render(<Wrapper message="Disappearing" />);
    await act(async () => {
      screen.getByText("Show Toast").click();
    });
    expect(screen.getByText("Disappearing")).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(3500);
    });
    expect(screen.queryByText("Disappearing")).not.toBeInTheDocument();
  });

  it("toast is still visible before 3500ms", async () => {
    render(<Wrapper message="Still here" />);
    await act(async () => {
      screen.getByText("Show Toast").click();
    });
    await act(async () => {
      jest.advanceTimersByTime(3499);
    });
    expect(screen.getByText("Still here")).toBeInTheDocument();
  });

  it("defaults to success type when type is not specified", async () => {
    const { container } = render(<Wrapper message="Default type" />);
    await act(async () => {
      screen.getByText("Show Toast").click();
    });
    const toast = container.querySelector(".bg-emerald-600");
    expect(toast).toBeInTheDocument();
  });

  it("applies error styles for error type", async () => {
    const { container } = render(<Wrapper message="Oh no" type="error" />);
    await act(async () => {
      screen.getByText("Show Toast").click();
    });
    const toast = container.querySelector(".bg-red-600");
    expect(toast).toBeInTheDocument();
  });

  it("applies info styles for info type", async () => {
    const { container } = render(<Wrapper message="FYI" type="info" />);
    await act(async () => {
      screen.getByText("Show Toast").click();
    });
    const toast = container.querySelector(".bg-gray-900");
    expect(toast).toBeInTheDocument();
  });

  it("can show multiple toasts at once", async () => {
    function MultiConsumer() {
      const { show } = useToast();
      return (
        <>
          <button onClick={() => show("Toast Alpha")}>triggerA</button>
          <button onClick={() => show("Toast Beta")}>triggerB</button>
        </>
      );
    }
    render(<ToastProvider><MultiConsumer /></ToastProvider>);
    await act(async () => {
      screen.getByText("triggerA").click();
      screen.getByText("triggerB").click();
    });
    expect(screen.getByText("Toast Alpha")).toBeInTheDocument();
    expect(screen.getByText("Toast Beta")).toBeInTheDocument();
  });
});
