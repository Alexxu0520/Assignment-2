const participantInput = document.getElementById("participant-id");
const startBtn = document.getElementById("start-btn");

startBtn.addEventListener("click", () => {
  const participantID = participantInput.value.trim();

  if (!participantID) {
    alert("Please enter a Participant ID.");
    return;
  }

  localStorage.setItem("participantID", participantID);
  window.location.href = "/chat.html";
});

participantInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    startBtn.click();
  }
});