const flashContainer = document.querySelectorAll("#flashMessage");
const alertUpdate = document.querySelector("#noScript")
const navBarColorBg = document.querySelector("#navigationColor")

if(flashContainer.length > 0) {
    flashContainer.forEach(element => {
        setTimeout(function() {
            element.style.display = 'none'
        },5000)
    })
}

// alertUpdate.addEventListener("click",() => {
//     alert("Update in progress!!!")
// })

document.addEventListener('DOMContentLoaded', function() {
    const currentUrl = window.location.href;
    if(currentUrl.includes('administrator')) {
        navBarColorBg.classList.add('navBarBgColorBlue')
    } else {
        navBarColorBg.classList.add('navBarBgColorRed')
    }
});