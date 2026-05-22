import { createRoot } from "react-dom/client";
import { act } from "react";
import { useForm } from "react-hook-form";
import { describe, expect, it } from "vitest";

import { SearchableSelect } from "@/components/form/SearchableSelect";
import type { FormValues } from "@/types/formFields";

const OPTIONS = [
  { value: "", label: "" },
  { value: "Voluntaria", label: "Voluntaria" },
  { value: "Obligatoria", label: "Obligatoria" },
];

function SelectHarness({
  onValue,
}: {
  onValue?: (v: string) => void;
}) {
  const { control, watch } = useForm<FormValues>({
    defaultValues: { tipo_proyecto_financiacion: "" } as FormValues,
  });
  const v = watch("tipo_proyecto_financiacion");
  if (onValue) {
    onValue(String(v ?? ""));
  }
  return (
    <SearchableSelect
      name="tipo_proyecto_financiacion"
      control={control}
      options={OPTIONS}
      label="Tipo"
    />
  );
}

describe("SearchableSelect", () => {
  it("aplica la opción al elegir con mousedown (sin revertir por blur)", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    let current = "";

    await act(async () => {
      root.render(
        <SelectHarness
          onValue={(v) => {
            current = v;
          }}
        />,
      );
    });

    const input = container.querySelector(
      'input[role="combobox"]',
    ) as HTMLInputElement;
    expect(input).toBeTruthy();

    await act(async () => {
      input.focus();
      input.value = "Vol";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("focus", { bubbles: true }));
    });

    const option = container.querySelector(
      'li[role="option"][aria-selected="false"]',
    ) as HTMLLIElement;
    expect(option?.textContent).toContain("Voluntaria");

    await act(async () => {
      option.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
      option.dispatchEvent(
        new TouchEvent("touchstart", { bubbles: true, cancelable: true }),
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(current).toBe("Voluntaria");
    expect(input.value).toBe("Voluntaria");

    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("no enfoca el siguiente campo del formulario al elegir una opción", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(
        <form>
          <SelectHarness />
          <input data-testid="siguiente" />
        </form>,
      );
    });

    const input = container.querySelector(
      'input[role="combobox"]',
    ) as HTMLInputElement;
    const next = container.querySelector(
      '[data-testid="siguiente"]',
    ) as HTMLInputElement;

    await act(async () => {
      input.focus();
      input.dispatchEvent(new Event("focus", { bubbles: true }));
    });

    const option = Array.from(
      container.querySelectorAll('li[role="option"]'),
    ).find((li) => li.textContent?.includes("Voluntaria")) as HTMLLIElement;

    await act(async () => {
      option.dispatchEvent(
        new MouseEvent("mousedown", { bubbles: true, cancelable: true }),
      );
    });

    await act(async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    expect(document.activeElement).not.toBe(next);

    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
