"use client";

import { useActionState, useRef, useState } from "react";
import {
  assignFileToInput,
  compressImageForMandoubUpload,
} from "@/lib/client-image-compress";
import {
  uploadShopDoorPhoto,
  type UploadDoorPhotoState,
} from "./actions";

const initial: UploadDoorPhotoState = {};

export function MandoubDoorPhotoForm({
  orderId,
  nextUrl,
  c,
  exp,
  s,
}: {
  orderId: string;
  nextUrl: string;
  c: string;
  exp: string;
  s: string;
}) {
  const [state, formAction, pending] = useActionState(uploadShopDoorPhoto, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [compressing, setCompressing] = useState(false);

  const busy = compressing || pending;

  return (
    <form
      ref={formRef}
      action={formAction}
      encType="multipart/form-data"
      className="space-y-2"
    >
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="next" value={nextUrl} />
      <input type="hidden" name="c" value={c} />
      <input type="hidden" name="exp" value={exp} />
      <input type="hidden" name="s" value={s} />

      <input
        ref={inputRef}
        name="doorPhoto"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={async () => {
          const input = inputRef.current;
          const form = formRef.current;
          if (!input?.files?.length || !form) return;
          const raw = input.files[0];
          setCompressing(true);
          try {
            const out = await compressImageForMandoubUpload(raw);
            assignFileToInput(input, out);
          } catch {
            /* يبقى الملف الأصلي */
          } finally {
            setCompressing(false);
          }
          form.requestSubmit();
        }}
      />

      <div className="grid grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const el = inputRef.current;
            if (!el) return;
            el.setAttribute("capture", "environment");
            el.click();
          }}
          className="inline-flex w-full items-center justify-center rounded-xl border border-sky-400 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-900 shadow-sm hover:bg-sky-100 disabled:opacity-60"
        >
          📷 كاميرا
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            const el = inputRef.current;
            if (!el) return;
            el.removeAttribute("capture");
            el.click();
          }}
          className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          🖼 معرض
        </button>
        {compressing ? (
          <span className="col-span-2 text-sm font-bold text-sky-800">
            جارٍ تصغير الصورة…
          </span>
        ) : pending ? (
          <span className="col-span-2 text-sm font-bold text-sky-800">
            جارٍ رفع الصورة…
          </span>
        ) : null}
      </div>

      <button type="submit" className="sr-only">
        submit
      </button>

      {state.error ? (
        <p className="text-sm font-medium text-rose-600" role="alert">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
