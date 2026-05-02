/**
 * @jest-environment jsdom
 */
import { render } from "@testing-library/react";
import { Spinner } from "@/components/ui/Spinner";

describe("Spinner", () => {
  it("renders an SVG element", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("svg")).toBeInTheDocument();
  });

  it("applies the animate-spin class by default", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("svg")).toHaveClass("animate-spin");
  });

  it("applies the default size classes", () => {
    const { container } = render(<Spinner />);
    expect(container.querySelector("svg")).toHaveClass("h-5", "w-5");
  });

  it("merges a custom className", () => {
    const { container } = render(<Spinner className="h-4 w-4 text-white" />);
    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("h-4", "w-4", "text-white");
    expect(svg).toHaveClass("animate-spin");
  });

  it("does not crash when className is empty string", () => {
    expect(() => render(<Spinner className="" />)).not.toThrow();
  });
});
