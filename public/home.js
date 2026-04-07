const participantForm = document.getElementById("participant-form");
const participantInput = document.getElementById("participant-id");

participantForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const participantID = participantInput.value.trim();

  if (!participantID) {
    alert("Please enter your Participant ID.");
    return;
  }

  localStorage.setItem("participantID", participantID);

  const numericID = parseInt(participantID, 10);
  const systemID = !Number.isNaN(numericID) && numericID % 2 === 0 ? 2 : 1;

  localStorage.setItem("systemID", String(systemID));

  window.location.href = `/chat.html?participantID=${encodeURIComponent(
    participantID
  )}&systemID=${systemID}`;
});