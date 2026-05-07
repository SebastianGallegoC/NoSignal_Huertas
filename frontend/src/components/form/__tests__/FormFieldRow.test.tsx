import React from "react";
import { createRoot } from "react-dom/client";
import { describe, it, expect } from "vitest";
import { act } from "react";
import { FormFieldRow } from "../FormFieldRow";
import { useForm } from "react-hook-form";

function Wrapper({ name, editable }: { name: any; editable?: boolean }) {
  const { register, control } = useForm({ defaultValues: {} });
  return (
    // @ts-ignore - minimal props for rendering
    <FormFieldRow
      name={name}
      register={register}
      control={control}
      editableGpsFields={editable}
    />
  );
}

describe("FormFieldRow editableGpsFields", () => {
  it("marca campos GPS como readOnly cuando editableGpsFields=false", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Wrapper name="latitud" editable={false} />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    root.unmount();
    container.remove();
  });

  it("permite editar campos GPS cuando editableGpsFields=true", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    act(() => {
      root.render(<Wrapper name="latitud" editable={true} />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    root.unmount();
    container.remove();
  });
});
