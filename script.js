document.addEventListener("DOMContentLoaded", function() {
    setTimeout(function() {
        var splashScreen = document.getElementById("splash-screen");
        splashScreen.style.opacity = 0;
        splashScreen.style.visibility = 'hidden';

        splashScreen.addEventListener("transitionend", function() {
            splashScreen.style.display = "none";
            document.body.classList.add('show-content');
        });
    }, 5000);
});
