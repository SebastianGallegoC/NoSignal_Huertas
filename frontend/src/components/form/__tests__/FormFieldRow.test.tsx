import { createRoot } from "react-dom/client";
import { describe, it, expect } from "vitest";
import { act } from "react";
import { FormFieldRow } from "../FormFieldRow";
import { useForm } from "react-hook-form";
import type { FormFieldKey, FormValues } from "@/types/formFields";

function Wrapper({
  name,
  editable,
}: {
  name: FormFieldKey;
  editable?: boolean;
}) {
  const { register, control } = useForm<FormValues>({
    defaultValues: {} as FormValues,
  });
  return (
    <FormFieldRow
      name={name}
      register={register}
      control={control}
      editableGpsFields={editable}
    />
  );
}

describe("FormFieldRow editableGpsFields", () => {
  it("marca campos GPS como readOnly cuando editableGpsFields=false", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Wrapper name="latitud" editable={false} />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.readOnly).toBe(true);
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("permite editar campos GPS cuando editableGpsFields=true", async () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<Wrapper name="latitud" editable={true} />);
    });
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.readOnly).toBe(false);
    act(() => {
      root.unmount();
    });
    container.remove();
  });
});
