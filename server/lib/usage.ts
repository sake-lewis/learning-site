// Requests sent to Google today, shown in Settings so free-tier quota errors are easier to read.
// Informational only: nothing is blocked on this count.

// Google's quota day runs from midnight to midnight Pacific time; count on the same calendar.
const PACIFIC_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' });

export class UsageCounter {
  private date = '';
  private calls = 0;

  private rollOver(): void {
    const today = PACIFIC_DATE.format(new Date());
    if (today !== this.date) {
      this.date = today;
      this.calls = 0;
    }
  }

  count(): void {
    this.rollOver();
    this.calls++;
  }

  snapshot(): { date: string; calls: number } {
    this.rollOver();
    return { date: this.date, calls: this.calls };
  }
}
