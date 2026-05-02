/**
 * @jest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { StatusBadge } from "@/components/ui/StatusBadge";

describe("StatusBadge", () => {
  const statuses = ["DRAFT", "PENDING", "APPROVED", "DELIVERED", "CANCELLED"];

  statuses.forEach((status) => {
    it(`renders the ${status} label`, () => {
      render(<StatusBadge status={status} />);
      expect(screen.getByText(status)).toBeInTheDocument();
    });
  });

  it("applies amber styling for PENDING", () => {
    const { container } = render(<StatusBadge status="PENDING" />);
    expect(container.firstChild).toHaveClass("bg-amber-50", "text-amber-700");
  });

  it("applies violet styling for APPROVED", () => {
    const { container } = render(<StatusBadge status="APPROVED" />);
    expect(container.firstChild).toHaveClass("bg-violet-50", "text-violet-700");
  });

  it("applies emerald styling for DELIVERED", () => {
    const { container } = render(<StatusBadge status="DELIVERED" />);
    expect(container.firstChild).toHaveClass("bg-emerald-50", "text-emerald-700");
  });

  it("applies red styling for CANCELLED", () => {
    const { container } = render(<StatusBadge status="CANCELLED" />);
    expect(container.firstChild).toHaveClass("bg-red-50", "text-red-600");
  });

  it("applies gray styling for DRAFT", () => {
    const { container } = render(<StatusBadge status="DRAFT" />);
    expect(container.firstChild).toHaveClass("bg-gray-50", "text-gray-600");
  });

  it("falls back to gray styling for unknown status", () => {
    const { container } = render(<StatusBadge status="UNKNOWN" />);
    expect(container.firstChild).toHaveClass("bg-gray-50", "text-gray-600");
    expect(screen.getByText("UNKNOWN")).toBeInTheDocument();
  });

  it("renders a colored dot inside the badge", () => {
    const { container } = render(<StatusBadge status="PENDING" />);
    const dot = container.querySelector("span span");
    expect(dot).toBeInTheDocument();
    expect(dot).toHaveClass("rounded-full");
  });

  it("renders as an inline span", () => {
    const { container } = render(<StatusBadge status="DRAFT" />);
    expect(container.firstChild?.nodeName).toBe("SPAN");
  });
});
