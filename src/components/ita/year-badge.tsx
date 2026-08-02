/** `year` is the พ.ศ. string straight from the database — never converted here. */
export function YearBadge({ year }: { year: string }) {
  return (
    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
      ปี พ.ศ. {year}
    </span>
  );
}
