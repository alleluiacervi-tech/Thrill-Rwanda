const serviceSenders: Readonly<Partial<Record<string, readonly [string, string]>>> = {
  BOOKING: ["bookings", "Bookings"],
  PAYMENT: ["payments", "Payments"],
  FLIGHT: ["flights", "Flights"],
  TRIP: ["trips", "Trips"],
  STAY: ["stays", "Stays"],
  TRANSPORT: ["transport", "Transport"],
  GROUP: ["groups", "Groups"],
  EVENT: ["events", "Events"],
  GENERAL: ["enquiries", "Enquiries"],
};

export function resendSender(service?: string) {
  const domain = process.env.EMAIL_SENDER_DOMAIN?.trim();
  const sender = service && Object.hasOwn(serviceSenders, service) ? serviceSenders[service] : undefined;
  if (!domain || !sender) return process.env.EMAIL_FROM;

  const [address, department] = sender;
  return `Thrill Rwanda ${department} <${address}@${domain}>`;
}
