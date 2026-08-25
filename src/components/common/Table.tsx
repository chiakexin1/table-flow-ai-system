"use client";

type Column<T> = {
  header: string;
  accessor: keyof T;
};

type TableProps<T extends Record<string, any>> = {
  columns: Column<T>[];
  data: T[];
};

export default function Table<T extends Record<string, any>>({
  columns,
  data,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground">
        No records found.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border bg-card">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.accessor)}
                className="px-4 py-2 text-left text-sm font-medium text-foreground"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-background">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-muted/50">
              {columns.map((col) => (
                <td
                  key={String(col.accessor)}
                  className="px-4 py-2 text-sm text-foreground"
                >
                  {String(row[col.accessor])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}