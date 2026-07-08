// 서비스워커 등록(모든 페이지 공용). 실패해도 앱은 정상 동작.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("/service-worker.js").catch(function () {});
  });
}
