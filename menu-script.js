const burger = document.getElementById('id7a7l'); // The hamburger button
const menu = document.querySelector('.navbar-items-c'); // The menu container

burger.addEventListener('click', () => {
    menu.classList.toggle('active');
});
