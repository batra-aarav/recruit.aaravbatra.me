const burger = document.querySelector('.navbar-burger');
const menu = document.querySelector('.navbar-items-c');

burger.addEventListener('click', () => {
    menu.classList.toggle('active');
});
