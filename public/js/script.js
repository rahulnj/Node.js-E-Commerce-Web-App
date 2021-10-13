


// to search
function myFunction() {
    // Declare variables
    var input, filter, table, tr, td, i, txtValue;
    input = document.getElementById("myInput");
    filter = input.value.toUpperCase();
    table = document.getElementById("userTable");
    tr = table.getElementsByTagName("tr");

    // Loop through all table rows, and hide those who don't match the search query
    for (i = 0; i < tr.length; i++) {
        td = tr[i].getElementsByTagName("td")[0];
        if (td) {
            txtValue = td.textContent || td.innerText;
            if (txtValue.toUpperCase().indexOf(filter) > -1) {
                tr[i].style.display = "";
            } else {
                tr[i].style.display = "none";
            }
        }
    }
}


// 
// function addTobag(proId) {
//     $.ajax({
//         url: '/add-to-bag/' + proId,
//         method: 'get',
//         success: (response) => {
//             console.log(response)
//             if (response.status) {
//                 let count = $('#bag-count').html()
//                 console.log(count)
//                 count = parseInt(count) + 1
//                 $("#bag-count").html(count)
//             }
//             // alert(response)
//             // location.href = "/dogretailvet"
//         }
//     })
// }
//

//
function changeQuantity(cartId, proId, count) {
    let quantity = parseInt(document.getElementById(proId).innerHTML)
    count = parseInt(count)
    $.ajax({
        url: '/change-quantity',
        data: {
            cart: cartId,
            product: proId,
            count: count,
            quantity: quantity
        },
        method: 'post',
        success: (response) => {
            // console.log(response.removeProduct);
            if (response.removeProduct) {
                // alert("Removed from bag")
                location.reload()
            } else {
                document.getElementById(proId).innerHTML = quantity + count
            }

        }
    })
}

// deleteItem
function deleteItem(cartId, proId) {
    console.log(cartId, proId)
    $.ajax({
        url: '/delete-item',
        data: {
            cart: cartId,
            product: proId,
        },
        method: 'post',
        success: (response) => {
            if (response) {
                // alert("Deleted")
                location.reload()
            }
        }
    })
}









