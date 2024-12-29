const burger = document.getElementById('navbar-container'); // The hamburger button
const menu = document.querySelector('.navbar-items-c'); // The menu container

burger.addEventListener('click', () => {
    menu.classList.toggle('active');
});
