"use client";

import { useTransition } from "react";
import { deleteDish } from "../actions/dish";
import { Spinner } from "../SubmitButton";
import { buttonClass } from "../ui";

export function DeleteDishButton({ dishId, name }: { dishId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={buttonClass.danger}
      onClick={() => {
        if (confirm(`Supprimer définitivement « ${name} », sa photo et ses modèles 3D ?`)) start(() => deleteDish(dishId));
      }}
    >
      {pending ? <Spinner /> : null}
      Supprimer le plat
    </button>
  );
}
