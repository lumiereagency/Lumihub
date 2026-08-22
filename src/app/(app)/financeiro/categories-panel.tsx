"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  createFinancialCategoryAction,
  deleteFinancialCategoryAction,
  createCostCenterAction,
  deleteCostCenterAction,
} from "@/lib/actions/finance-category-actions";
import { FINANCIAL_CATEGORY_TYPE_LABELS } from "@/lib/validation/finance";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

interface Category {
  id: string;
  name: string;
  type: string;
}

interface CostCenter {
  id: string;
  name: string;
}

export function CategoriesPanel({
  categories,
  costCenters,
  canManage,
}: {
  categories: Category[];
  costCenters: CostCenter[];
  canManage: boolean;
}) {
  const [, startTransition] = useTransition();
  const [catName, setCatName] = useState("");
  const [ccName, setCcName] = useState("");

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Categorias financeiras</CardTitle>
        </CardHeader>
        {categories.length === 0 ? (
          <EmptyState title="Nenhuma categoria cadastrada" />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {categories.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-text-primary">{c.name}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={c.type === "RECEITA" ? "success" : "neutral"}>
                    {FINANCIAL_CATEGORY_TYPE_LABELS[c.type as keyof typeof FINANCIAL_CATEGORY_TYPE_LABELS] ?? c.type}
                  </Badge>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => startTransition(() => deleteFinancialCategoryAction(c.id))}
                      className="text-text-tertiary hover:text-error"
                      aria-label="Excluir categoria"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        {canManage && (
          <form
            action={(formData) => {
              startTransition(async () => {
                await createFinancialCategoryAction({}, formData);
              });
              setCatName("");
            }}
            className="mt-3 flex gap-2"
          >
            <Input
              name="name"
              placeholder="Nova categoria..."
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              required
              className="flex-1"
            />
            <Select name="type" defaultValue="DESPESA" className="w-32">
              <option value="DESPESA">Despesa</option>
              <option value="RECEITA">Receita</option>
            </Select>
            <Button type="submit" size="sm">
              <Plus size={14} />
            </Button>
          </form>
        )}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Centros de custo</CardTitle>
        </CardHeader>
        {costCenters.length === 0 ? (
          <EmptyState title="Nenhum centro de custo cadastrado" />
        ) : (
          <div className="flex flex-col divide-y divide-border">
            {costCenters.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="text-text-primary">{c.name}</span>
                {canManage && (
                  <button
                    type="button"
                    onClick={() => startTransition(() => deleteCostCenterAction(c.id))}
                    className="text-text-tertiary hover:text-error"
                    aria-label="Excluir centro de custo"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {canManage && (
          <form
            action={(formData) => {
              startTransition(async () => {
                await createCostCenterAction({}, formData);
              });
              setCcName("");
            }}
            className="mt-3 flex gap-2"
          >
            <Input
              name="name"
              placeholder="Novo centro de custo..."
              value={ccName}
              onChange={(e) => setCcName(e.target.value)}
              required
              className="flex-1"
            />
            <Button type="submit" size="sm">
              <Plus size={14} />
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
