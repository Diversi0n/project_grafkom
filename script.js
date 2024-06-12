document.addEventListener("DOMContentLoaded", function() {
    setTimeout(function() {
        var splashScreen = document.getElementById("splash-screen");
        splashScreen.style.opacity = 0;
        splashScreen.style.transition = "opacity 0.5s ease";

        splashScreen.addEventListener("transitionend", function() {
            splashScreen.style.display = "none";
            document.getElementById("content").style.display = "block";
        });
    }, 5000);
});
