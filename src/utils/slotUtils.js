// helpers for overlap checking & parsing
export const toRange = (startDateTime, durationMin) => {
  const start = new Date(startDateTime);
  const end = new Date(start.getTime() + durationMin * 60000);
  return { start, end };
};

export const isOverlapping = (aStart, aEnd, bStart, bEnd) => {
  return (aStart < bEnd) && (bStart < aEnd);
};

// parse slot object or dateTime into Date ranges
export const getRangeFromAppointment = (appt) => {
  if (appt.dateTime) {
    const start = new Date(appt.dateTime);
    const end = new Date(start.getTime() + (appt.duration || 60) * 60000);
    return { start, end };
  }
  if (appt.slot && appt.slot.date && appt.slot.time) {
    const [h, m] = appt.slot.time.split(':').map(Number);
    const [y, mo, d] = appt.slot.date.split('-').map(Number);
    const start = new Date(y, mo - 1, d, h, m);
    const end = new Date(start.getTime() + (appt.duration || 60) * 60000);
    return { start, end };
  }
  throw new Error("Invalid appointment date info");
};
