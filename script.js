const $ = (id) => document.getElementById(id);

const money = (n) => new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", maximumFractionDigits: 0
}).format(Math.max(0, n));

function getInputs() {
  return {
    principal: Number($("loanAmount").value),
    annualRate: Number($("interestRate").value),
    years: Number($("tenureYears").value),
    extra: Number($("extraMonthly").value),
    oneTime: Number($("oneTime").value),
    prepayMonth: Number($("prepayMonth").value)
  };
}

function emi(principal, annualRate, months) {
  const r = annualRate / 12 / 100;
  if (r === 0) return principal / months;
  return principal * r * Math.pow(1 + r, months) / (Math.pow(1 + r, months) - 1);
}

function regularSchedule(P, annualRate, months, payment) {
  let balance = P, interest = 0, rows = [];
  const r = annualRate / 12 / 100;
  for (let m = 1; m <= months && balance > 0.005; m++) {
    const int = balance * r;
    const principalPaid = Math.min(balance, Math.max(0, payment - int));
    const actualPayment = int + principalPaid;
    balance -= principalPaid;
    interest += int;
    rows.push({month:m, opening:balance + principalPaid, payment:actualPayment, extra:0, interest:int, principal:principalPaid, closing:Math.max(0,balance)});
  }
  return {interest, total: P + interest, rows};
}

function strategySchedule(P, annualRate, months, baseEmi, extra, oneTime, prepayMonth) {
  let balance = P, interest = 0, totalPaid = 0, rows = [];
  const r = annualRate / 12 / 100;
  for (let m = 1; m <= months * 2 && balance > 0.005; m++) {
    const opening = balance;
    const int = balance * r;
    let regularPayment = Math.min(baseEmi, balance + int);
    let principalPaid = Math.min(balance, Math.max(0, regularPayment - int));
    balance -= principalPaid;
    let extraPaid = 0;

    if (extra > 0 && balance > 0) {
      extraPaid = Math.min(extra, balance);
      balance -= extraPaid;
    }
    if (m === prepayMonth && oneTime > 0 && balance > 0) {
      const one = Math.min(oneTime, balance);
      extraPaid += one;
      balance -= one;
    }

    const actualPayment = regularPayment + extraPaid;
    interest += int;
    totalPaid += actualPayment;
    rows.push({
      month:m, opening, payment:regularPayment, extra:extraPaid,
      interest:int, principal:principalPaid + extraPaid, closing:Math.max(0,balance)
    });
    if (m > months * 2) break;
  }
  return {interest, total:totalPaid, rows};
}

function validate(x) {
  if (!x.principal || x.principal <= 0) return "Enter a valid loan amount.";
  if (x.annualRate < 0 || x.annualRate > 100) return "Interest rate must be between 0 and 100%.";
  if (!x.years || x.years <= 0 || x.years > 50) return "Tenure must be between 1 and 50 years.";
  if (x.extra < 0 || x.oneTime < 0) return "Extra payments cannot be negative.";
  if (x.prepayMonth < 1) return "Prepayment month must be at least 1.";
  return "";
}

function calculate() {
  const x = getInputs();
  const error = validate(x);
  if (error) { alert(error); return; }

  const months = Math.round(x.years * 12);
  const baseEmi = emi(x.principal, x.annualRate, months);
  const regular = regularSchedule(x.principal, x.annualRate, months, baseEmi);
  const strategy = strategySchedule(
    x.principal, x.annualRate, months, baseEmi,
    x.extra, x.oneTime, Math.min(x.prepayMonth, months)
  );

  const monthsSaved = Math.max(0, regular.rows.length - strategy.rows.length);
  const saved = Math.max(0, regular.interest - strategy.interest);

  $("emi").textContent = money(baseEmi);
  $("regularInterest").textContent = money(regular.interest);
  $("strategyInterest").textContent = money(strategy.interest);
  $("interestSaved").textContent = money(saved);
  $("regularTenure").textContent = `${regular.rows.length} months`;
  $("strategyTenure").textContent = `${strategy.rows.length} months`;
  $("monthsSaved").textContent = `${monthsSaved} months`;
  $("strategyTotal").textContent = money(strategy.total);

  let text = `With the selected strategy, you could finish the loan about ${monthsSaved} month(s) earlier and save approximately ${money(saved)} in interest.`;
  if (x.extra === 0 && x.oneTime === 0) {
    text = "You have not added any extra payment. Add a monthly extra amount or one-time prepayment to compare a faster repayment strategy.";
  }
  $("summary").textContent = text;

  const body = $("scheduleBody");
  body.innerHTML = strategy.rows.map(row => `
    <tr>
      <td>${row.month}</td>
      <td>${money(row.opening)}</td>
      <td>${money(row.payment)}</td>
      <td>${money(row.extra)}</td>
      <td>${money(row.interest)}</td>
      <td>${money(row.principal)}</td>
      <td>${money(row.closing)}</td>
    </tr>
  `).join("");

  window.currentSchedule = strategy.rows;
  $("results").classList.remove("hidden");
  $("results").scrollIntoView({behavior:"smooth", block:"start"});
}

function resetForm() {
  $("loanAmount").value = 500000;
  $("interestRate").value = 10;
  $("tenureYears").value = 5;
  $("extraMonthly").value = 2000;
  $("oneTime").value = 0;
  $("prepayMonth").value = 12;
  $("results").classList.add("hidden");
}

function downloadCSV() {
  if (!window.currentSchedule?.length) return;
  const header = ["Month","Opening Balance","Regular Payment","Extra Payment","Interest","Principal","Closing Balance"];
  const rows = window.currentSchedule.map(r => [
    r.month, r.opening.toFixed(2), r.payment.toFixed(2), r.extra.toFixed(2),
    r.interest.toFixed(2), r.principal.toFixed(2), r.closing.toFixed(2)
  ]);
  const csv = [header, ...rows].map(row => row.join(",")).join("\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8;"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "loan-amortization-schedule.csv";
  a.click();
  URL.revokeObjectURL(url);
}

$("calculateBtn").addEventListener("click", calculate);
$("resetBtn").addEventListener("click", resetForm);
$("downloadBtn").addEventListener("click", downloadCSV);
calculate();
