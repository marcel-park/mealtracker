package io.github.marcel_park.mealtracker.service;

import io.github.marcel_park.mealtracker.dto.UserItemRequest;
import io.github.marcel_park.mealtracker.dto.UserItemResponse;
import io.github.marcel_park.mealtracker.dto.UserItemScope;
import io.github.marcel_park.mealtracker.exception.ConflictException;
import io.github.marcel_park.mealtracker.exception.InvalidRequestException;
import io.github.marcel_park.mealtracker.exception.NotFoundException;
import io.github.marcel_park.mealtracker.model.UserItem;
import io.github.marcel_park.mealtracker.model.User;
import io.github.marcel_park.mealtracker.repository.UserItemRepository;
import io.github.marcel_park.mealtracker.repository.ShoppingListItemRepository;
import io.github.marcel_park.mealtracker.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class UserItemServiceTest {

    @Mock
    private UserItemRepository itemRepository;

    @Mock
    private ShoppingListItemRepository shoppingListItemRepository;

    @Mock
    private UserRepository userRepository;

    private UserItemService service;

    private static final Long USER_ID = 7L;
    private final User me = user(USER_ID);
    private final User other = user(8L);

    @BeforeEach
    void setUp() {
        service = new UserItemService(itemRepository, shoppingListItemRepository, userRepository);
    }

    private static User user(Long id) {
        User user = new User();
        user.setId(id);
        return user;
    }

    private static UserItem item(Long id, User owner, String name) {
        UserItem item = new UserItem(owner, name);
        item.setId(id);
        return item;
    }

    // ---------- find ----------

    @Test
    void find_ownItems_searchesTheNameAsPart() {
        when(itemRepository.searchOwn(USER_ID, "%spül%", PageRequest.of(0, 50)))
                .thenReturn(List.of(item(1L, me, "Spülmittel")));

        List<UserItemResponse> result = service.find(USER_ID, " Spül ", UserItemScope.OWN, 0, 50);

        assertThat(result).containsExactly(new UserItemResponse(1L, "Spülmittel", true));
    }

    @Test
    void find_withoutScopeOrQuery_listsAllOwnItems() {
        when(itemRepository.searchOwn(USER_ID, "%", PageRequest.of(1, 20)))
                .thenReturn(List.of(item(1L, me, "Batterien")));

        assertThat(service.find(USER_ID, null, null, 1, 20)).hasSize(1);
    }

    // No friends yet, so nobody shares items with the user.
    @Test
    void find_friends_findsNothingYet() {
        assertThat(service.find(USER_ID, "a", UserItemScope.FRIENDS, 0, 50)).isEmpty();
        verifyNoInteractions(itemRepository);
    }

    @Test
    void find_invalidPage_isRejected() {
        assertThatThrownBy(() -> service.find(USER_ID, "a", UserItemScope.OWN, 0, 101))
                .isInstanceOf(InvalidRequestException.class);
    }

    // ---------- create / update ----------

    @Test
    void create_storesTheTrimmedNameForTheUser() {
        when(itemRepository.existsNameOf(USER_ID, "Spülmittel", null)).thenReturn(false);
        when(userRepository.getReferenceById(USER_ID)).thenReturn(me);
        when(itemRepository.save(any())).thenAnswer(invocation -> {
            UserItem saved = invocation.getArgument(0);
            saved.setId(3L);
            return saved;
        });

        UserItemResponse result = service.create(USER_ID, new UserItemRequest("  Spülmittel "));

        ArgumentCaptor<UserItem> captor = ArgumentCaptor.forClass(UserItem.class);
        verify(itemRepository).save(captor.capture());
        assertThat(captor.getValue().getName()).isEqualTo("Spülmittel");
        assertThat(captor.getValue().getOwner()).isSameAs(me);
        assertThat(result).isEqualTo(new UserItemResponse(3L, "Spülmittel", true));
    }

    @Test
    void create_nameTheUserHasAlready_isAConflict() {
        when(itemRepository.existsNameOf(USER_ID, "milch", null)).thenReturn(true);

        assertThatThrownBy(() -> service.create(USER_ID, new UserItemRequest("milch")))
                .isInstanceOf(ConflictException.class);
        verify(itemRepository, never()).save(any());
    }

    @Test
    void update_renamesTheOwnItem() {
        UserItem detergent = item(3L, me, "Spülmittel");
        when(itemRepository.findById(3L)).thenReturn(Optional.of(detergent));
        when(itemRepository.existsNameOf(USER_ID, "Spülmaschinentabs", 3L)).thenReturn(false);

        UserItemResponse result = service.update(USER_ID, 3L, new UserItemRequest("Spülmaschinentabs "));

        assertThat(detergent.getName()).isEqualTo("Spülmaschinentabs");
        assertThat(result.name()).isEqualTo("Spülmaschinentabs");
    }

    @Test
    void update_toTheNameOfAnotherOwnItem_isAConflict() {
        UserItem detergent = item(3L, me, "Spülmittel");
        when(itemRepository.findById(3L)).thenReturn(Optional.of(detergent));
        when(itemRepository.existsNameOf(USER_ID, "Batterien", 3L)).thenReturn(true);

        assertThatThrownBy(() -> service.update(USER_ID, 3L, new UserItemRequest("Batterien")))
                .isInstanceOf(ConflictException.class);
        assertThat(detergent.getName()).isEqualTo("Spülmittel");
    }

    @Test
    void update_itemOfSomebodyElse_isNotFound() {
        when(itemRepository.findById(4L)).thenReturn(Optional.of(item(4L, other, "Kerzen")));

        assertThatThrownBy(() -> service.update(USER_ID, 4L, new UserItemRequest("Meins")))
                .isInstanceOf(NotFoundException.class);
    }

    // ---------- delete ----------

    @Test
    void delete_takesTheItemOffEveryShoppingListFirst() {
        UserItem detergent = item(3L, me, "Spülmittel");
        when(itemRepository.findById(3L)).thenReturn(Optional.of(detergent));

        service.delete(USER_ID, 3L);

        InOrder order = inOrder(shoppingListItemRepository, itemRepository);
        order.verify(shoppingListItemRepository).deleteAllWithUserItem(3L);
        order.verify(itemRepository).delete(detergent);
    }

    @Test
    void delete_itemOfSomebodyElse_isNotFound() {
        when(itemRepository.findById(4L)).thenReturn(Optional.of(item(4L, other, "Kerzen")));

        assertThatThrownBy(() -> service.delete(USER_ID, 4L)).isInstanceOf(NotFoundException.class);
        verify(itemRepository, never()).delete(any());
        verifyNoInteractions(shoppingListItemRepository);
    }

    // ---------- visibility ----------

    @Test
    void getVisibleEntity_unknownItem_isNotFound() {
        when(itemRepository.findById(9L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getVisibleEntity(USER_ID, 9L)).isInstanceOf(NotFoundException.class);
    }
}
