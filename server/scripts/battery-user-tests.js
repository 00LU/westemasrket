const base = 'http://localhost:5000/api';
const ts = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
const pwd = '1234';
const results = [];

function addResult(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`TEST ${name} => ${ok ? 'PASS' : 'FAIL'} | ${detail}`);
}

async function registerUser(role, companyName, email, piva) {
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, companyName, piva, email, password: pwd }),
  });
  if (!res.ok) throw new Error(`register failed status=${res.status} body=${await res.text()}`);
  return res.json();
}

async function loginUser(email) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pwd }),
  });
  if (!res.ok) throw new Error(`login failed status=${res.status} body=${await res.text()}`);
  return res.json();
}

async function api(method, path, token, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const err = new Error(`status=${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function main() {
  try {
    const health = await fetch(`${base}/health`);
    console.log(`API_HEALTH=${health.status}`);

    const producerEmail = `producer_test_${ts}@example.com`;
    const recipient1Email = `recipient1_test_${ts}@example.com`;
    const recipient2Email = `recipient2_test_${ts}@example.com`;
    const transporter1Email = `transporter1_test_${ts}@example.com`;
    const transporter2Email = `transporter2_test_${ts}@example.com`;

    await registerUser('producer', 'Producer Test', producerEmail, `PIVA-PROD-${ts}`);
    await registerUser('recipient', 'Recipient Test 1', recipient1Email, `PIVA-REC1-${ts}`);
    await registerUser('recipient', 'Recipient Test 2', recipient2Email, `PIVA-REC2-${ts}`);
    await registerUser('transporter', 'Transporter Test 1', transporter1Email, `PIVA-TRA1-${ts}`);
    await registerUser('transporter', 'Transporter Test 2', transporter2Email, `PIVA-TRA2-${ts}`);

    const producer = await loginUser(producerEmail);
    const recipient1 = await loginUser(recipient1Email);
    const recipient2 = await loginUser(recipient2Email);
    const transporter1 = await loginUser(transporter1Email);
    const transporter2 = await loginUser(transporter2Email);

    const reqA = await api('POST', '/producers/waste-requests', producer.token, {
      cerCode: 'CER-15-01-02',
      quantityTon: 4.2,
      pickupAddress: 'Via Test 1, Milano',
      pickupLat: 45.46,
      pickupLng: 9.19,
      deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      maxPrice: 3000,
    });
    const reqAId = reqA.request.id;

    await api('POST', '/recipients/offers', recipient1.token, {
      wasteRequestId: reqAId,
      pricePerTon: 190,
      destinationAddress: 'Dest A1',
      availableCapacityTon: 10,
      availabilityStatus: 'available',
      notes: 'Offer A1',
    });

    const boardA1 = await api('GET', '/producers/recipient-offers', producer.token);
    const entryA1 = boardA1.find((x) => x.request.id === reqAId);
    const offerA1 = entryA1.offers[0].id;

    const selRecA = await api('PATCH', `/producers/waste-requests/${reqAId}/select-recipient`, producer.token, { recipientOfferId: offerA1 });
    const accRecA = await api('PATCH', `/recipients/waste-requests/${reqAId}/accept-selection`, recipient1.token, {});

    await api('POST', '/bids', transporter1.token, {
      wasteRequestId: reqAId,
      transportPrice: 350,
      vehicleType: 'ADR Truck',
      availability: 'Tomorrow AM',
    });

    const boardA2 = await api('GET', '/producers/recipient-offers', producer.token);
    const entryA2 = boardA2.find((x) => x.request.id === reqAId);
    const bidA1 = entryA2.bids[0].id;

    const selTraA = await api('PATCH', `/producers/waste-requests/${reqAId}/select-transport`, producer.token, { bidId: bidA1 });
    const accTraA = await api('PATCH', `/transporters/waste-requests/${reqAId}/accept-selection`, transporter1.token, {});

    await api('PATCH', `/transporters/waste-requests/${reqAId}/status`, transporter1.token, { status: 'in_execution' });
    await api('PATCH', `/transporters/waste-requests/${reqAId}/status`, transporter1.token, { status: 'delivered' });
    const doneA = await api('PATCH', `/transporters/waste-requests/${reqAId}/status`, transporter1.token, { status: 'completed' });

    addResult(
      'A_happy_path_complete',
      selRecA.status === 'recipient_selected' &&
        accRecA.status === 'transporter_matching' &&
        selTraA.status === 'package_selected' &&
        accTraA.status === 'assigned' &&
        doneA.status === 'completed',
      `request=${reqAId} final=${doneA.status}`
    );

    const reqB = await api('POST', '/producers/waste-requests', producer.token, {
      cerCode: 'CER-19-12-05',
      quantityTon: 2.8,
      pickupAddress: 'Via Test 2, Torino',
      pickupLat: 45.07,
      pickupLng: 7.68,
      deadline: new Date(Date.now() + 4 * 24 * 3600 * 1000).toISOString(),
      maxPrice: 1800,
    });
    const reqBId = reqB.request.id;

    await api('POST', '/recipients/offers', recipient1.token, {
      wasteRequestId: reqBId,
      pricePerTon: 210,
      destinationAddress: 'Dest B1',
      availableCapacityTon: 6,
      availabilityStatus: 'available',
      notes: 'Offer B1',
    });
    await api('POST', '/recipients/offers', recipient2.token, {
      wasteRequestId: reqBId,
      pricePerTon: 170,
      destinationAddress: 'Dest B2',
      availableCapacityTon: 8,
      availabilityStatus: 'available',
      notes: 'Offer B2',
    });

    const boardB1 = await api('GET', '/producers/recipient-offers', producer.token);
    const entryB1 = boardB1.find((x) => x.request.id === reqBId);
    const firstOffer = entryB1.offers[0].id;
    const lastOffer = entryB1.offers[entryB1.offers.length - 1].id;

    const selB1 = await api('PATCH', `/producers/waste-requests/${reqBId}/select-recipient`, producer.token, { recipientOfferId: firstOffer });
    const selB2 = await api('PATCH', `/producers/waste-requests/${reqBId}/select-recipient`, producer.token, { recipientOfferId: lastOffer, allowReplace: true });

    addResult(
      'B_recipient_replace_allowReplace',
      selB1.selectedRecipientOfferId !== selB2.selectedRecipientOfferId,
      `request=${reqBId} first=${selB1.selectedRecipientOfferId} second=${selB2.selectedRecipientOfferId}`
    );

    let cOk = false;
    try {
      await api('PATCH', `/producers/waste-requests/${reqBId}/select-recipient`, producer.token, { recipientOfferId: firstOffer });
    } catch (error) {
      cOk = error.status === 409;
    }
    addResult('C_recipient_replace_without_allowReplace', cOk, `request=${reqBId} expected=409`);

    const reqD = await api('POST', '/producers/waste-requests', producer.token, {
      cerCode: 'CER-12-03-01',
      quantityTon: 5.0,
      pickupAddress: 'Via Test 3, Bologna',
      pickupLat: 44.49,
      pickupLng: 11.34,
      deadline: new Date(Date.now() + 5 * 24 * 3600 * 1000).toISOString(),
      maxPrice: 3500,
    });
    const reqDId = reqD.request.id;

    await api('POST', '/recipients/offers', recipient1.token, {
      wasteRequestId: reqDId,
      pricePerTon: 200,
      destinationAddress: 'Dest D1',
      availableCapacityTon: 12,
      availabilityStatus: 'available',
      notes: 'Offer D1',
    });

    const boardD1 = await api('GET', '/producers/recipient-offers', producer.token);
    const entryD1 = boardD1.find((x) => x.request.id === reqDId);
    await api('PATCH', `/producers/waste-requests/${reqDId}/select-recipient`, producer.token, { recipientOfferId: entryD1.offers[0].id });
    await api('PATCH', `/recipients/waste-requests/${reqDId}/accept-selection`, recipient1.token, {});

    await api('POST', '/bids', transporter1.token, {
      wasteRequestId: reqDId,
      transportPrice: 300,
      vehicleType: 'ADR Truck',
      availability: 'AM',
    });
    await api('POST', '/bids', transporter2.token, {
      wasteRequestId: reqDId,
      transportPrice: 280,
      vehicleType: 'Container Truck',
      availability: 'PM',
    });

    const boardD2 = await api('GET', '/producers/recipient-offers', producer.token);
    const entryD2 = boardD2.find((x) => x.request.id === reqDId);
    const firstBid = entryD2.bids[0].id;
    const secondBid = entryD2.bids[entryD2.bids.length - 1].id;

    await api('PATCH', `/producers/waste-requests/${reqDId}/select-transport`, producer.token, { bidId: firstBid });

    let dOk = false;
    try {
      await api('PATCH', `/producers/waste-requests/${reqDId}/select-transport`, producer.token, { bidId: secondBid, allowReplace: true });
    } catch (error) {
      dOk = error.status === 404;
    }
    addResult('D_transport_replace_currently_blocked', dOk, `request=${reqDId} expected=404 after first selection`);

    const pass = results.filter((x) => x.ok).length;
    const fail = results.filter((x) => !x.ok).length;
    console.log(`BATTERY_SUMMARY pass=${pass} fail=${fail} total=${results.length}`);
    process.exit(fail > 0 ? 2 : 0);
  } catch (error) {
    const message = error.status ? `status=${error.status} body=${JSON.stringify(error.data)}` : error.message;
    console.log(`BATTERY_FATAL=${message}`);
    process.exit(1);
  }
}

main();
