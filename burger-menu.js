const burger = document.getElementById('navbar-container');
const menu = document.querySelector('.navbar-items-c');

burger.addEventListener('click', () => {
    menu.classList.toggle('active');
});
