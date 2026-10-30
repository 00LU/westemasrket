export const PICKUP_FORM_DEFAULTS = {
  pickupAddress: '', pickupLat: null, pickupLng: null, pickupPlaceId: '', productionSiteId: '',
  wasteDescription: '', cerKnown: true, cerCode: '', technicalDocuments: '',
  quantity: '', quantityUnit: 'kg',
  containment: '', specialInfo: '', deadline: '', recurring: false,
  recurrenceFrequency: 'monthly', recurrenceStartDate: '', recurrenceEndDate: '',
};

export function pickupFormErrors(form) {
  const errors = {};
  if (form.cerKnown && !form.cerCode.trim()) errors.cerCode = 'Seleziona il codice CER oppure richiedi assistenza.';
  if (!(Number(form.quantity) > 0) || !Number.isFinite(Number(form.quantity))) errors.quantity = 'Inserisci una quantità maggiore di zero.';
  if (!['kg', 'liter'].includes(form.quantityUnit)) errors.quantityUnit = 'Seleziona kg o litri.';
  if (!form.pickupAddress.trim()) errors.pickupAddress = 'Inserisci l’indirizzo di ritiro.';
  if (!form.deadline || new Date(`${form.deadline}T23:59:00`).getTime() <= Date.now()
    || Number.isNaN(new Date(`${form.deadline}T23:59:00`).getTime())) errors.deadline = 'Scegli una data limite non precedente a oggi.';
  if (form.recurring) {
    if (!form.recurrenceStartDate) errors.recurrenceStartDate = 'Indica l’inizio della ricorrenza.';
    if (!form.recurrenceEndDate || form.recurrenceEndDate < form.recurrenceStartDate) errors.recurrenceEndDate = 'La fine deve essere uguale o successiva all’inizio.';
  }
  return errors;
}

export function pickupToForm(request) {
  const deadline = request.deadline ? new Date(request.deadline) : null;
  const date = deadline
    ? `${deadline.getFullYear()}-${String(deadline.getMonth() + 1).padStart(2, '0')}-${String(deadline.getDate()).padStart(2, '0')}`
    : '';
  return {
    ...PICKUP_FORM_DEFAULTS,
    ...Object.fromEntries(Object.keys(PICKUP_FORM_DEFAULTS).map((key) => [key, request[key] ?? PICKUP_FORM_DEFAULTS[key]])),
    deadline: date,
    cerCode: request.cerKnown === false ? '' : request.cerCode,
  };
}
