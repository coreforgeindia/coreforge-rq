"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Plus,
  RotateCcw,
  ShieldCheck,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import {
  DEFAULT_PRICING,
  formatCouponBenefit,
  formatINR,
} from "@/lib/portal-data";
import type {
  Coupon,
  CouponBenefitType,
  PackageName,
  PricingSettings,
  Role,
} from "@/lib/portal-types";

interface PricingCouponsViewProps {
  role: Role;
  pricing: PricingSettings;
  coupons: Coupon[];
  onSavePricing: (next: PricingSettings) => void;
  onCreateCoupon: (coupon: Omit<Coupon, "id" | "usageCount">) => void;
  onToggleCoupon: (id: string) => void;
  onDeleteCoupon: (id: string) => void;
}

const PACKAGE_ORDER: PackageName[] = ["Launch", "Growth", "Scale"];

export function PricingCouponsView({
  role,
  pricing,
  coupons,
  onSavePricing,
  onCreateCoupon,
  onToggleCoupon,
  onDeleteCoupon,
}: PricingCouponsViewProps) {
  const [draft, setDraft] = useState<PricingSettings>(pricing);
  const [dirty, setDirty] = useState(false);
  const [showCreateCoupon, setShowCreateCoupon] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [benefitType, setBenefitType] = useState<CouponBenefitType>(
    "percentage_discount"
  );
  const [discountPercent, setDiscountPercent] = useState(10);
  const [bonusPages, setBonusPages] = useState(2);
  const [discountAmount, setDiscountAmount] = useState(2500);
  const [allowedPackages, setAllowedPackages] = useState<PackageName[]>([
    "Launch",
    "Growth",
    "Scale",
  ]);
  const [maxUses, setMaxUses] = useState("");
  const [expiry, setExpiry] = useState("");
  const [couponDesc, setCouponDesc] = useState("");
  const [couponError, setCouponError] = useState("");

  useEffect(() => {
    setDraft(pricing);
    setDirty(false);
  }, [pricing]);

  const isAdmin = role === "Admin";

  const updatePackageField = <K extends keyof PricingSettings["packages"]["Launch"]>(
    pkg: PackageName,
    key: K,
    value: PricingSettings["packages"]["Launch"][K]
  ) => {
    setDraft((prev) => ({
      ...prev,
      packages: {
        ...prev.packages,
        [pkg]: {
          ...prev.packages[pkg],
          [key]: value,
        },
      },
    }));
    setDirty(true);
  };

  const handleSave = () => {
    onSavePricing(draft);
    setDirty(false);
  };

  const handleReset = () => {
    setDraft(DEFAULT_PRICING);
    onSavePricing(DEFAULT_PRICING);
    setDirty(false);
  };

  const handleCreateCoupon = () => {
    const cleanCode = couponCode.trim().toUpperCase();
    if (!cleanCode) {
      setCouponError("Coupon code is required.");
      return;
    }
    if (coupons.some((c) => c.code.toUpperCase() === cleanCode)) {
      setCouponError("A coupon with this code already exists.");
      return;
    }
    if (allowedPackages.length === 0) {
      setCouponError("Select at least one package.");
      return;
    }

    const description =
      couponDesc.trim() ||
      (benefitType === "percentage_discount"
        ? `${discountPercent}% off package & extra pages`
        : benefitType === "bonus_pages"
        ? `+${bonusPages} additional sitemap pages`
        : `${formatINR(discountAmount)} flat discount`);

    onCreateCoupon({
      code: cleanCode,
      benefitType,
      bonusPages: benefitType === "bonus_pages" ? Math.max(1, bonusPages) : 0,
      discountPercent:
        benefitType === "percentage_discount"
          ? Math.min(100, Math.max(1, discountPercent))
          : 0,
      discountAmount:
        benefitType === "fixed_discount" ? Math.max(1, discountAmount) : 0,
      allowedPackages,
      active: true,
      maxUses: maxUses ? Math.max(1, Number(maxUses)) : null,
      expiry: expiry.trim() || "Not set",
      description,
    });

    setCouponCode("");
    setCouponDesc("");
    setMaxUses("");
    setExpiry("");
    setCouponError("");
    setShowCreateCoupon(false);
  };

  return (
    <>
      <div className="page-title-row">
        <div>
          <div className="eyebrow">COMMERCIAL SETTINGS</div>
          <h1>Coupons &amp; pricing</h1>
          <p className="muted">
            Edit package prices, page allowances, additional page rates, and
            promotional coupons (including 10%, 25%, and 50% off).
          </p>
        </div>
        <div className="row-actions">
          {isAdmin && dirty && (
            <button type="button" className="primary" onClick={handleSave}>
              <Check size={15} /> Save pricing
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              className="primary"
              onClick={() => setShowCreateCoupon(true)}
            >
              <Plus size={16} /> Create coupon
            </button>
          )}
        </div>
      </div>

      {!isAdmin && (
        <div className="note-box" style={{ marginBottom: 15, marginTop: 0 }}>
          <ShieldCheck size={18} />
          <div>
            <b>Admin-only editing</b>
            <p>
              You are previewing as Developer. Package pricing and coupon
              management are read-only; switch to Admin to edit rates.
            </p>
          </div>
        </div>
      )}

      <div className="pricing-grid">
        {PACKAGE_ORDER.map((pkgName) => {
          const pkg = draft.packages[pkgName];
          return (
            <div className="surface price-card editable-price-card" key={pkgName}>
              <div className="card-top">
                <span className="soft-tag">{pkg.name}</span>
                <span className="small muted">
                  {draft.hostingIncluded
                    ? "Hosting included"
                    : "Hosting separate"}
                </span>
              </div>

              {isAdmin ? (
                <div className="price-edit-fields">
                  <label>
                    Package price (₹)
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={pkg.price}
                      onChange={(e) =>
                        updatePackageField(
                          pkgName,
                          "price",
                          Math.max(0, Number(e.target.value) || 0)
                        )
                      }
                    />
                  </label>
                  <div className="form-grid" style={{ gap: 10 }}>
                    <label>
                      Included pages
                      <input
                        type="number"
                        min={1}
                        value={pkg.limit}
                        onChange={(e) =>
                          updatePackageField(
                            pkgName,
                            "limit",
                            Math.max(1, Number(e.target.value) || 1)
                          )
                        }
                      />
                    </label>
                    <label>
                      Internal hosting cost (₹)
                      <input
                        type="number"
                        min={0}
                        placeholder="Not set"
                        value={pkg.internalHostingCost ?? ""}
                        onChange={(e) =>
                          updatePackageField(
                            pkgName,
                            "internalHostingCost",
                            e.target.value === ""
                              ? null
                              : Math.max(0, Number(e.target.value) || 0)
                          )
                        }
                      />
                    </label>
                  </div>
                  <label>
                    Package description
                    <textarea
                      rows={2}
                      value={pkg.description}
                      onChange={(e) =>
                        updatePackageField(pkgName, "description", e.target.value)
                      }
                    />
                  </label>
                </div>
              ) : (
                <>
                  <h2>{formatINR(pkg.price)}</h2>
                  <p>{pkg.limit} pages included</p>
                  <small>{pkg.description}</small>
                </>
              )}
            </div>
          );
        })}
      </div>

      {isAdmin && (
        <section className="surface" style={{ marginBottom: 15 }}>
          <div className="section-head">
            <div>
              <h2>Additional page &amp; hosting rules</h2>
              <p>
                Hosting is included in package pricing for clients; internal
                hosting costs are visible only to Admins.
              </p>
            </div>
            <div className="row-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleReset}
              >
                <RotateCcw size={14} /> Reset defaults
              </button>
              <button type="button" className="primary" onClick={handleSave}>
                <Check size={14} /> Save pricing settings
              </button>
            </div>
          </div>

          <div className="grid3-form">
            <label className="field-label">
              Additional page price (₹)
              <input
                type="number"
                min={0}
                placeholder="Not configured (Pending)"
                value={draft.additionalPagePrice ?? ""}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    additionalPagePrice:
                      e.target.value === ""
                        ? null
                        : Math.max(0, Number(e.target.value) || 0),
                  }));
                  setDirty(true);
                }}
              />
            </label>

            <label className="field-label">
              Hosting renewal / billing note
              <select
                value={draft.hostingFrequency}
                onChange={(e) => {
                  setDraft((prev) => ({
                    ...prev,
                    hostingFrequency: e.target.value as PricingSettings["hostingFrequency"],
                  }));
                  setDirty(true);
                }}
              >
                <option value="To be confirmed">To be confirmed</option>
                <option value="Monthly">Monthly</option>
                <option value="Annually">Annually</option>
                <option value="One-time">One-time</option>
              </select>
            </label>

            <label className="field-label checkbox-card">
              <span>Client hosting rule</span>
              <div className="inline-check">
                <input
                  type="checkbox"
                  checked={draft.hostingIncluded}
                  onChange={(e) => {
                    setDraft((prev) => ({
                      ...prev,
                      hostingIncluded: e.target.checked,
                    }));
                    setDirty(true);
                  }}
                />
                <span>Hosting included in package price (₹0 extra)</span>
              </div>
            </label>
          </div>
        </section>
      )}

      <section className="surface">
        <div className="section-head">
          <div>
            <h2>Active &amp; promotional coupons</h2>
            <p>
              Includes page bonus (OFFPLUS2) and percentage discounts (10%, 25%,
              50% off).
            </p>
          </div>
          <span className="soft-tag">
            {coupons.filter((c) => c.active).length} active coupons
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>CODE</th>
                <th>BENEFIT</th>
                <th>PACKAGES</th>
                <th>USAGE</th>
                <th>STATUS</th>
                <th>EXPIRY</th>
                {isAdmin && <th>ACTIONS</th>}
              </tr>
            </thead>
            <tbody>
              {coupons.map((c) => (
                <tr key={c.id}>
                  <td>
                    <div className="coupon-code-cell">
                      <Tag size={13} />
                      <b>{c.code}</b>
                    </div>
                    <small className="muted" style={{ display: "block", marginTop: 2 }}>
                      {c.description}
                    </small>
                  </td>
                  <td>
                    <span className="soft-tag">{formatCouponBenefit(c)}</span>
                  </td>
                  <td>{c.allowedPackages.join(", ")}</td>
                  <td>
                    {c.usageCount} / {c.maxUses ?? "Unlimited"}
                  </td>
                  <td>
                    <span className={c.active ? "status-live" : "stage-pill"}>
                      {c.active ? "Active" : "Paused"}
                    </span>
                  </td>
                  <td>{c.expiry}</td>
                  {isAdmin && (
                    <td>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="secondary compact-btn"
                          onClick={() => onToggleCoupon(c.id)}
                        >
                          {c.active ? "Pause" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="icon-button danger-text"
                          aria-label={`Delete ${c.code}`}
                          onClick={() => onDeleteCoupon(c.id)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {showCreateCoupon && isAdmin && (
        <div
          className="modal-backdrop"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setShowCreateCoupon(false);
          }}
        >
          <div className="modal">
            <div className="modal-head">
              <div>
                <div className="eyebrow">PROMOTIONAL RULE</div>
                <h2>Create coupon</h2>
                <p>
                  Configure a percentage discount, bonus page grant, or fixed ₹
                  discount.
                </p>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setShowCreateCoupon(false)}
              >
                <X size={19} />
              </button>
            </div>

            <div className="form-grid">
              <label>
                Coupon code *
                <input
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  placeholder="e.g. LAUNCH25"
                />
              </label>

              <label>
                Benefit type
                <select
                  value={benefitType}
                  onChange={(e) =>
                    setBenefitType(e.target.value as CouponBenefitType)
                  }
                >
                  <option value="percentage_discount">
                    Percentage discount (% off)
                  </option>
                  <option value="bonus_pages">Bonus sitemap pages (+)</option>
                  <option value="fixed_discount">Fixed discount (₹)</option>
                </select>
              </label>

              {benefitType === "percentage_discount" && (
                <label style={{ gridColumn: "1 / -1" }}>
                  Discount percentage (%)
                  <div className="preset-row">
                    {[10, 25, 50].map((pct) => (
                      <button
                        type="button"
                        key={pct}
                        className={`tag-pill-btn ${discountPercent === pct ? "tagged" : ""}`}
                        onClick={() => setDiscountPercent(pct)}
                      >
                        {pct}% off
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={100}
                      value={discountPercent}
                      onChange={(e) =>
                        setDiscountPercent(
                          Math.min(100, Math.max(1, Number(e.target.value) || 1))
                        )
                      }
                      style={{ width: 90 }}
                    />
                  </div>
                </label>
              )}

              {benefitType === "bonus_pages" && (
                <label>
                  Bonus pages
                  <input
                    type="number"
                    min={1}
                    value={bonusPages}
                    onChange={(e) =>
                      setBonusPages(Math.max(1, Number(e.target.value) || 1))
                    }
                  />
                </label>
              )}

              {benefitType === "fixed_discount" && (
                <label>
                  Discount amount (₹)
                  <input
                    type="number"
                    min={1}
                    value={discountAmount}
                    onChange={(e) =>
                      setDiscountAmount(
                        Math.max(1, Number(e.target.value) || 1)
                      )
                    }
                  />
                </label>
              )}

              <label>
                Max uses (optional)
                <input
                  type="number"
                  min={1}
                  placeholder="Unlimited"
                  value={maxUses}
                  onChange={(e) => setMaxUses(e.target.value)}
                />
              </label>

              <label>
                Expiry date (optional)
                <input
                  type="date"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                />
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                Allowed packages
                <div className="inline-check-row">
                  {PACKAGE_ORDER.map((pkg) => (
                    <label key={pkg} className="inline-check-chip">
                      <input
                        type="checkbox"
                        checked={allowedPackages.includes(pkg)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAllowedPackages((prev) => [...prev, pkg]);
                          } else {
                            setAllowedPackages((prev) =>
                              prev.filter((x) => x !== pkg)
                            );
                          }
                        }}
                      />
                      <span>{pkg}</span>
                    </label>
                  ))}
                </div>
              </label>

              <label style={{ gridColumn: "1 / -1" }}>
                Description
                <input
                  value={couponDesc}
                  onChange={(e) => setCouponDesc(e.target.value)}
                  placeholder="Optional note shown in pricing summary"
                />
              </label>
            </div>

            {couponError && (
              <p className="small error-text" style={{ marginTop: 10 }}>
                {couponError}
              </p>
            )}

            <div className="modal-foot">
              <button
                type="button"
                className="secondary"
                onClick={() => setShowCreateCoupon(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                onClick={handleCreateCoupon}
              >
                Save coupon
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

