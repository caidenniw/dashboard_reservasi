import type { KolomMaster } from "@/config/master";
import type { Opsi } from "@/lib/master-server";
import { rupiah } from "@/lib/format";

/*
 * Satu kolom form master — port dari master/field.blade.php.
 * Tipe: select, textarea, rupiah, number, date, tel, foto, text.
 * Murni server-rendered (tanpa state) supaya kontrak name/id tetap persis.
 */
export function FieldMaster({
    c,
    nilai,
    opsi,
}: {
    c: KolomMaster;
    nilai: string;
    opsi: Opsi;
}) {
    const id = `f_${c.name}`;
    const lebar = c.lebar ?? "col-md-6";
    const wajib = Boolean(c.wajib);

    return (
        <div className={lebar}>
            <label className="form-label" htmlFor={id}>
                {c.label}
                {wajib && <> <span className="wajib">*</span></>}
            </label>

            {c.tipe === "select" ? (
                <select className="form-select" id={id} name={c.name} required={wajib} defaultValue={nilai}>
                    {opsi.map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                    ))}
                </select>
            ) : c.tipe === "textarea" ? (
                <textarea className="form-control" id={id} name={c.name} rows={2} required={wajib} defaultValue={nilai} />
            ) : c.tipe === "rupiah" ? (
                <div className="input-group">
                    <span className="input-group-text">Rp</span>
                    <input
                        type="text"
                        className="form-control input-rupiah"
                        id={id}
                        name={c.name}
                        defaultValue={nilai !== "" && nilai !== null ? rupiah(nilai, false) : ""}
                        required={wajib}
                    />
                </div>
            ) : c.tipe === "number" ? (
                <input type="number" className="form-control" id={id} name={c.name} defaultValue={nilai} required={wajib} />
            ) : c.tipe === "date" ? (
                <>
                    <input type="date" className="form-control" id={id} name={c.name} defaultValue={nilai} required={wajib} />
                    <span className="bantu-tanggal">dd/mm/yyyy</span>
                </>
            ) : c.tipe === "tel" ? (
                <input type="text" className="form-control" id={id} name={c.name} defaultValue={nilai} placeholder="08xx / +62xx" />
            ) : c.tipe === "foto" ? (
                <>
                    {nilai !== "" && nilai !== null && (
                        <div className="mb-2 flex items-center gap-2">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={`/${nilai.replace(/^\/+/, "")}`} alt="Foto" className="thumb-form" />
                            <div className="form-check">
                                <input className="form-check-input" type="checkbox" id={`hapus-${id}`} name={`hapus_${c.name}`} value="1" />
                                <label className="form-check-label" htmlFor={`hapus-${id}`}>Hapus foto</label>
                            </div>
                        </div>
                    )}
                    <input type="file" className="form-control" id={id} name={c.name} accept="image/png,image/jpeg,image/webp" />
                    <div className="form-text">{c.help ?? "JPG/PNG, maksimal 2 MB."}</div>
                </>
            ) : (
                <input type="text" className="form-control" id={id} name={c.name} defaultValue={nilai} required={wajib} />
            )}

            {c.help && c.tipe !== "foto" && <div className="form-text">{c.help}</div>}
        </div>
    );
}
