"use client";

import Table from "@/components/common/Table";

const dummyColumns = [
  { header: "Date", accessor: "date" },
  { header: "Time", accessor: "time" },
  { header: "Name", accessor: "name" },
  { header: "Party", accessor: "party" },
  { header: "Status", accessor: "status" },
];

const dummyData = [];

const Bookings = () => (
  <section className="space-y-4">
    <h1 className="text-3xl font-bold text-foreground">Bookings</h1>

    <Table columns={dummyColumns} data={dummyData} />
  </section>
);

export default Bookings;